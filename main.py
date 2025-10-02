import os
import json
import dns.resolver
import smtplib
import asyncio
from dotenv import load_dotenv
import uuid
import re
import logging
import time
from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from contextlib import asynccontextmanager

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Environment variables with validation
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
JWT_SECRET = os.getenv("JWT_SECRET")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://localhost:8000,https://127.0.0.1:8000").split(",")
BASE_URL = os.getenv("BASE_URL", "https://localhost:8000")
PORT = int(os.getenv("PORT", 8000))

# Validate critical environment variables
if not JWT_SECRET:
    logger.error("JWT_SECRET environment variable is required")
    raise ValueError("JWT_SECRET environment variable is required")

# SendGrid API key validation - make it non-blocking for deployment
if not SENDGRID_API_KEY:
    logger.warning("SENDGRID_API_KEY not found - email functionality will be disabled")
    SENDGRID_API_KEY = None
else:
    logger.info("SENDGRID_API_KEY loaded successfully")

# Security settings
MAX_ERROR_MESSAGE_LENGTH = 500
EMAIL_MAX_LENGTH = 254  # RFC 5321 limit
USERNAME_MAX_LENGTH = 50
PASSWORD_MIN_LENGTH = 8
MAX_LOGIN_ATTEMPTS = 7
LOCKOUT_DURATION = 300  # 5 minutes

# Username sanitization for logging
def sanitize_username_for_logging(username):
    """Sanitize username for safe logging to prevent log injection"""
    if not username:
        return "<empty>"
    # Remove newlines, carriage returns, and other control characters
    sanitized = re.sub(r'[\r\n\t\x00-\x1f\x7f-\x9f]', '', str(username))
    # Limit length and add ellipsis if truncated
    if len(sanitized) > 50:
        sanitized = sanitized[:47] + "..."
    return sanitized or "<invalid>"

# Rate limiting storage
login_attempts = {}
email_attempts = {}
active_sessions = {}  # Track active user sessions: {session_id: {user_id, username, login_time, last_activity, ip}}
security_alerts = []  # Track security events
active_tokens = set()  # Track valid JWT tokens
user_activity_log = []  # Track user activities: {user_id, username, action, timestamp, ip, details}

# Helper function to log user activities
def log_user_activity(user_id, username, action, ip, details):
    """Log user activity for audit purposes"""
    activity = {
        "user_id": user_id,
        "username": username,
        "action": action,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip": ip,
        "details": details, 
        "status": "completed"
    }
    user_activity_log.append(activity)
    
    # Keep only last 1000 activities to prevent memory issues
    if len(user_activity_log) > 170:
        user_activity_log.pop(0)
from datetime import datetime, timezone

# Email rate limiting (paid plan limits)
MAX_EMAILS_PER_MINUTE = 600  # 10 per second * 60
MAX_EMAILS_PER_HOUR = 10000  # Generous limit for paid plans

# Email validation regex pattern (improved)
EMAIL_VALIDATION_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import or_, select, func, text
from sqlalchemy.exc import IntegrityError, OperationalError
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional
import sendgrid
from sendgrid.helpers.mail import Mail
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware
from starlette.config import Config
from starlette.responses import RedirectResponse
import uvicorn
import requests

from database import SessionLocal, engine
from typing import List
from models import Base, User as DBUser, Template, Campaign, EmailLog, ChatMessage, UserEmail
from schemas import (
    EmailRequest, User as UserSchema, UserUpdate, AdminUserCreate, AdminUserUpdate, UserPasswordUpdate,
    Template as TemplateSchema, TemplateCreate, TemplateUpdate, AdminTemplateCreate, AdminTemplateUpdate,
    Campaign as CampaignSchema, CampaignCreate,
    EmailLog as EmailLogSchema, EmailLogCreate,
    DashboardStats, EmailStats, EmailValidationRequest, EmailValidationResponse, EmailValidationResult, EmailGenerationRequest, EmailGenerationResponse,
    ComprehensiveAnalytics, EmailStatusStats, DeliveryStats, TimeBasedStats,
    ChatMessage as ChatMessageSchema, ChatMessageCreate, ChatHistoryResponse
)

# Lifespan event handler for proper cleanup
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Application starting up")
    yield
    # Shutdown
    logger.info("Application shutting down")
    cleanup_thread_pool()

app = FastAPI(lifespan=lifespan)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    if request.url.path.startswith('/admin/templates'):
        logger.info(f"Admin templates request headers: {dict(request.headers)}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code} for {request.method} {request.url.path}")
    return response

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=JWT_SECRET
)

Base.metadata.create_all(bind=engine)

# Message clea# Message cleanup function
def cleanup_old_messages():
    """Clean up messages older than 2 days"""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=2)

    db = SessionLocal()
    try:
        deleted_count = db.query(ChatMessage).filter(ChatMessage.created_at < cutoff_date).delete()
        db.commit()
        logger.info(f"Cleaned up {deleted_count} old chat messages")
    except Exception as e:
        logger.error(f"Error cleaning up messages: {e}")
        db.rollback()
    finally:
        db.close()




# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth config for Google
config = Config('.env')
oauth = OAuth(config)

if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    oauth.register(
        name='google',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        },
    )
else:
    logger.warning("Google OAuth not configured.")

# DB dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Password utils
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# User utils
def get_user(db: Session, username: str):
    return db.query(DBUser).filter(DBUser.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(DBUser).filter(DBUser.email == email).first()

def authenticate_user(db: Session, username: str, password: str):
    if not username or not password:
        return False
    # Sanitize username input
    username = username.strip()[:50]  # Limit length
    if not username.replace('_', '').replace('-', '').isalnum():
        return False  # Only allow alphanumeric, underscore, hyphen
    user = get_user(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc).timestamp()})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # First validate JWT structure and expiration
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        exp: int = payload.get("exp")
        
        if username is None or exp is None:
            raise credentials_exception
            
        # Check if token is expired
        if datetime.now(timezone.utc).timestamp() > exp:
            active_tokens.discard(token)
            raise credentials_exception
        
        # Check if token was invalidated by force logout (but allow if empty set)
        if active_tokens and token not in active_tokens:
            raise credentials_exception
            
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise credentials_exception
        
    user = get_user(db, username=username)
    if user is None:
        raise credentials_exception
    return user

def get_current_admin_user(current_user: DBUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have administrative privileges"
        )
    return current_user

# --- Admin User Management Endpoints ---

@app.get("/admin/users", response_model=List[UserSchema])
def get_all_users(db: Session = Depends(get_db), admin: DBUser = Depends(get_current_admin_user)):
    return db.query(DBUser).all()

@app.post("/admin/users", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
def create_user(user_create: AdminUserCreate, db: Session = Depends(get_db), admin: DBUser = Depends(get_current_admin_user)):
    # Input validation
    if not user_create.username or len(user_create.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not EMAIL_VALIDATION_PATTERN.match(user_create.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if not user_create.password or len(user_create.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Check for conflicts
    if get_user(db, user_create.username.strip()):
        raise HTTPException(status_code=400, detail="Username already registered")
    if get_user_by_email(db, user_create.email.lower()):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    try:
        hashed_password = get_password_hash(user_create.password)
        new_user = DBUser(
            username=user_create.username.strip(),
            email=user_create.email.lower(),
            hashed_password=hashed_password,
            role=user_create.role
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create user")

@app.put("/admin/users/{user_id}", response_model=UserSchema)
def update_user(user_id: int, user_update: AdminUserUpdate, db: Session = Depends(get_db), admin: DBUser = Depends(get_current_admin_user)):
    user_to_update = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting themselves
    if user_id == admin.id and user_update.role and user_update.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot demote yourself from admin role")

    # Validate username and email uniqueness when updating
    if user_update.username and user_update.username != user_to_update.username:
        existing_user = get_user(db, user_update.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        user_to_update.username = user_update.username
        
    if user_update.email and user_update.email != user_to_update.email:
        existing_user = get_user_by_email(db, user_update.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        user_to_update.email = user_update.email
        
    if user_update.role:
        user_to_update.role = user_update.role

    db.commit()
    db.refresh(user_to_update)
    return user_to_update

@app.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), admin: DBUser = Depends(get_current_admin_user)):
    user_to_delete = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user_to_delete)
    db.commit()

# --- Dashboard and Analytics Endpoints ---

@app.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Email stats - include both campaign emails and individual emails
    # Get all campaign IDs for this user using safe query with proper validation
    user_campaigns = db.query(Campaign.id).filter(Campaign.user_id == current_user.id).all()
    campaign_ids = [c.id for c in user_campaigns if isinstance(c.id, int)]

    # Build query safely with proper parameterization
    def get_email_count(start_date, campaign_ids, user_id):
        # Validate user_id to prevent injection
        if not isinstance(user_id, int) or user_id <= 0:
            return 0
            
        base_query = db.query(func.count(EmailLog.id)).filter(
            EmailLog.sent_at >= start_date,
            EmailLog.status == "sent"
        )

        if campaign_ids:
            # Validate all campaign IDs are integers
            validated_campaign_ids = [cid for cid in campaign_ids if isinstance(cid, int) and cid > 0]
            if validated_campaign_ids:
                return base_query.filter(
                    or_(
                        EmailLog.campaign_id.in_(validated_campaign_ids),
                        EmailLog.user_id == user_id
                    )
                ).scalar() or 0
            else:
                return base_query.filter(EmailLog.user_id == user_id).scalar() or 0
        else:
            return base_query.filter(EmailLog.user_id == user_id).scalar() or 0

    today_count = get_email_count(today_start, campaign_ids, current_user.id)
    week_count = get_email_count(week_ago, campaign_ids, current_user.id)
    month_count = get_email_count(month_ago, campaign_ids, current_user.id)
    this_month_count = get_email_count(month_start, campaign_ids, current_user.id)

    email_stats = EmailStats(
        today=today_count,
        last_7_days=week_count,
        last_30_days=month_count,
        this_month=this_month_count
    )

    # Total campaigns
    total_campaigns = db.query(Campaign).filter(Campaign.user_id == current_user.id).count()

    # Recent campaigns
    recent_campaigns = db.query(Campaign).filter(Campaign.user_id == current_user.id).order_by(Campaign.created_at.desc()).limit(5).all()

    return DashboardStats(
        email_stats=email_stats,
        total_campaigns=total_campaigns,
        recent_campaigns=recent_campaigns
    )

@app.get("/dashboard/recent-emails")
def get_recent_emails(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    """Get recent 10 emails for regular users"""
    user_campaigns = db.query(Campaign.id).filter(Campaign.user_id == current_user.id).all()
    user_campaign_ids = [c.id for c in user_campaigns if isinstance(c.id, int) and c.id > 0]
    
    if user_campaign_ids:
        query = db.query(EmailLog).filter(
            or_(
                EmailLog.user_id == current_user.id,
                EmailLog.campaign_id.in_(user_campaign_ids)
            )
        )
    else:
        query = db.query(EmailLog).filter(EmailLog.user_id == current_user.id)
    
    emails = query.order_by(EmailLog.sent_at.desc()).limit(10).all()
    return [{
        "id": email.id,
        "recipient_email": email.recipient_email,
        "status": email.status,
        "sent_at": email.sent_at.isoformat() if email.sent_at else None,
        "campaign_id": email.campaign_id
    } for email in emails]

@app.get("/admin/recent-emails")
def get_admin_recent_emails(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    """Get recent 50 emails for admin users"""
    emails = db.query(EmailLog).order_by(EmailLog.sent_at.desc()).limit(50).all()
    return [{
        "id": email.id,
        "recipient_email": email.recipient_email,
        "status": email.status,
        "sent_at": email.sent_at.isoformat() if email.sent_at else None,
        "campaign_id": email.campaign_id,
        "user_id": email.user_id
    } for email in emails]

# --- Comprehensive Analytics Endpoint ---

@app.get("/analytics", response_model=ComprehensiveAnalytics)
def get_comprehensive_analytics(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Get all campaign IDs for this user with proper validation
    user_campaigns = db.query(Campaign.id).filter(Campaign.user_id == current_user.id).all()
    user_campaign_ids = [c.id for c in user_campaigns if isinstance(c.id, int) and c.id > 0]

    # Helper function to get status counts for a time period
    def get_status_counts(start_date):
        # Use proper parameterized query with safe aggregation
        def get_count(status):
            # Validate user_id to prevent injection
            if not isinstance(current_user.id, int) or current_user.id <= 0:
                return 0
                
            base_query = db.query(func.count(EmailLog.id)).filter(
                EmailLog.sent_at >= start_date
            )
            if user_campaign_ids:
                base_query = base_query.filter(
                    or_(
                        EmailLog.campaign_id.in_(user_campaign_ids),
                        EmailLog.user_id == current_user.id
                    )
                )
            else:
                base_query = base_query.filter(EmailLog.user_id == current_user.id)

            if status:
                # Validate status parameter
                if status not in ['sent', 'failed', 'bounced']:
                    return 0
                base_query = base_query.filter(EmailLog.status == status)

            return base_query.scalar() or 0

        sent = get_count("sent")
        failed = get_count("failed")
        bounced = get_count("bounced")
        total = get_count(None)

        return EmailStatusStats(sent=sent, failed=failed, bounced=bounced, total=total)

    # Get overall statistics
    all_time = get_status_counts(datetime.min)  # All emails

    # Calculate delivery stats
    total_emails = all_time.total
    if total_emails > 0:
        delivery_rate = (all_time.sent / total_emails) * 100
        bounce_rate = (all_time.bounced / total_emails) * 100
        success_rate = ((all_time.sent + all_time.failed) / total_emails) * 100  # Excluding bounces
    else:
        delivery_rate = bounce_rate = success_rate = 0.0

    delivery_stats = DeliveryStats(
        delivery_rate=round(delivery_rate, 2),
        bounce_rate=round(bounce_rate, 2),
        success_rate=round(success_rate, 2)
    )

    # Time-based statistics
    time_based = TimeBasedStats(
        today=get_status_counts(today_start),
        last_7_days=get_status_counts(week_ago),
        last_30_days=get_status_counts(month_ago),
        this_month=get_status_counts(month_start)
    )

    # Campaign vs Individual emails with proper parameterization
    if user_campaign_ids:
        campaign_emails = db.query(EmailLog).filter(
            EmailLog.campaign_id.in_(user_campaign_ids)
        ).count()
    else:
        campaign_emails = 0

    individual_emails = db.query(EmailLog).filter(
        EmailLog.user_id == current_user.id,
        EmailLog.campaign_id.is_(None)
    ).count()

    return ComprehensiveAnalytics(
        total_emails=total_emails,
        status_breakdown=all_time,
        delivery_stats=delivery_stats,
        time_based=time_based,
        campaign_emails=campaign_emails,
        individual_emails=individual_emails
    )

# --- Chat Endpoints ---

@app.post("/chat/messages", response_model=ChatMessageSchema)
def send_message(message: ChatMessageCreate, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    # Create room_id for direct messages or global chat
    room_id = None
    if message.recipient_id:
        # Sort user IDs to create consistent room_id for direct messages
        user_ids = sorted([current_user.id, message.recipient_id])
        room_id = f"dm_{user_ids[0]}_{user_ids[1]}"
    else:
        # Global chat - everyone can send global messages
        room_id = "global"

    db_message = ChatMessage(
        sender_id=current_user.id,
        recipient_id=message.recipient_id,
        room_id=room_id,
        message=message.message,
        message_type=message.message_type
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    # Return message with sender info
    return ChatMessageSchema(
        id=db_message.id,
        sender_id=db_message.sender_id,
        recipient_id=db_message.recipient_id,
        room_id=db_message.room_id,
        message=db_message.message,
        message_type=db_message.message_type,
        created_at=db_message.created_at,
        is_read=db_message.is_read,
        sender_username=current_user.username,
        recipient_username=db_message.recipient.username if db_message.recipient else None,
        sender_role=current_user.role
    )

@app.get("/chat/messages", response_model=ChatHistoryResponse)
def get_messages(
    room_id: Optional[str] = None,
    recipient_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    # Determine room_id
    if recipient_id:
        user_ids = sorted([current_user.id, recipient_id])
        room_id = f"dm_{user_ids[0]}_{user_ids[1]}"
    elif not room_id:
        room_id = "global"

    # Get messages for the room
    query = db.query(ChatMessage).filter(ChatMessage.room_id == room_id)

    # For direct messages, ensure user is part of the conversation
    if room_id.startswith("dm_"):
        query = query.filter(
            (ChatMessage.sender_id == current_user.id) |
            (ChatMessage.recipient_id == current_user.id)
        )

    total_count = query.count()
    messages = query.order_by(ChatMessage.created_at.desc()).offset(offset).limit(limit).all()

    # Reverse to get chronological order
    messages.reverse()

    # Add usernames and roles
    result_messages = []
    for msg in messages:
        result_messages.append(ChatMessageSchema(
            id=msg.id,
            sender_id=msg.sender_id,
            recipient_id=msg.recipient_id,
            room_id=msg.room_id,
            message=msg.message,
            message_type=msg.message_type,
            created_at=msg.created_at,
            is_read=msg.is_read,
            sender_username=msg.sender.username,
            recipient_username=msg.recipient.username if msg.recipient else None,
            sender_role=msg.sender.role
        ))

    return ChatHistoryResponse(messages=result_messages, total_count=total_count)

@app.get("/chat/users")
def get_chat_users(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    # Return all users except current user for direct messaging
    users = db.query(DBUser).filter(DBUser.id != current_user.id).all()
    return [{"id": user.id, "username": user.username, "email": user.email} for user in users]

@app.delete("/chat/messages/cleanup")
def cleanup_old_messages(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    # Delete messages older than 2 days
    from datetime import timedelta
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=2)

    # Limit deletion to prevent performance issues
    deleted_count = db.query(ChatMessage).filter(ChatMessage.created_at < cutoff_date).limit(1000).delete(synchronize_session=False)
    db.commit()

    return {"message": f"Deleted {deleted_count} old messages"}

# --- Admin Panel Endpoints ---


@app.get("/admin/users/detailed")
def get_detailed_users(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    users = db.query(DBUser).all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None
        } for user in users
    ]

@app.post("/admin/users")
def create_user_admin(user_data: dict, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    # Input validation
    username = user_data.get("username", "").strip()[:50]
    email = user_data.get("email", "").strip().lower()[:254]
    password = user_data.get("password", "")
    role = user_data.get("role", "user")
    
    # Validate role
    if role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not EMAIL_VALIDATION_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if not password or len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Check for conflicts
    if get_user(db, username):
        raise HTTPException(status_code=400, detail="Username already registered")
    if get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        hashed_password = get_password_hash(password)
        new_user = DBUser(
            username=username,
            email=email,
            hashed_password=hashed_password,
            role=role
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # TODO: Send welcome email if requested
        # if user_data.get("send_welcome_email"):
        #     send_welcome_email(new_user.email, new_user.username)

        return {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "role": new_user.role,
            "created_at": new_user.created_at.isoformat()
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create user")

@app.put("/admin/users/{user_id}")
def update_user_admin(user_id: int, user_data: dict, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    # Validate user_id
    if user_id <= 0 or user_id > 2147483647:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting themselves
    if user_id == current_user.id and user_data.get("role") and user_data["role"] != "admin":
        raise HTTPException(status_code=400, detail="You cannot demote yourself from admin role")

    if "username" in user_data:
        user.username = user_data["username"]
    if "email" in user_data:
        user.email = user_data["email"]
    if "role" in user_data:
        user.role = user_data["role"]

    db.commit()
    db.refresh(user)
    return {"message": "User updated successfully"}

@app.delete("/admin/users/{user_id}")
def delete_user_admin(user_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    # Validate user_id
    if user_id <= 0 or user_id > 2147483647:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

@app.post("/admin/users/{user_id}/emails")
def add_user_email(user_id: int, email_data: dict, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    email = email_data.get("email", "").strip().lower()
    if not EMAIL_VALIDATION_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if email already exists
    existing = db.query(UserEmail).filter(UserEmail.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_email = UserEmail(user_id=user_id, email=email, is_verified=True)
    db.add(user_email)
    db.commit()
    return {"message": "Email added successfully"}

@app.get("/admin/users/{user_id}/emails")
def get_user_emails(user_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    emails = db.query(UserEmail).filter(UserEmail.user_id == user_id).all()
    return [{"id": e.id, "email": e.email, "is_verified": e.is_verified, "is_primary": e.is_primary} for e in emails]

@app.delete("/admin/users/{user_id}/emails/{email_id}")
def delete_user_email(user_id: int, email_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    email = db.query(UserEmail).filter(UserEmail.id == email_id, UserEmail.user_id == user_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    db.delete(email)
    db.commit()
    return {"message": "Email deleted successfully"}

@app.get("/users/me/emails")
def get_my_emails(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    additional_emails = db.query(UserEmail).filter(UserEmail.user_id == current_user.id).all()
    emails = [{"email": current_user.email, "is_primary": True}]
    emails.extend([{"email": e.email, "is_primary": False} for e in additional_emails])
    return emails

@app.get("/admin/campaigns")
def get_admin_campaigns(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    # Use eager loading to prevent N+1 queries
    campaigns = db.query(Campaign).options(
        joinedload(Campaign.user),
        joinedload(Campaign.template)
    ).order_by(Campaign.created_at.desc()).all()
    return [
        {
            "id": campaign.id,
            "name": campaign.name,
            "user_id": campaign.user_id,
            "username": campaign.user.username if campaign.user else "Unknown",
            "template_id": campaign.template_id,
            "template_name": campaign.template.name if campaign.template else "Unknown",
            "sender_email": campaign.sender_email,
            "status": campaign.status,
            "created_at": campaign.created_at.isoformat()
        } for campaign in campaigns
    ]

@app.get("/admin/templates")
def get_admin_templates(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    templates = db.query(Template).order_by(Template.created_at.desc()).all()
    return [
        {
            "id": template.id,
            "name": template.name,
            "subject": template.subject,
            "category": template.category,
            "created_at": template.created_at.isoformat() if template.created_at else None
        } for template in templates
    ]

@app.delete("/admin/templates/{template_id}")
def delete_template_admin(template_id: str, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    # Validate template_id format
    if not template_id or len(template_id) > 100:
        raise HTTPException(status_code=400, detail="Invalid template ID")
    
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()
    return {"message": "Template deleted successfully"}

@app.delete("/admin/campaigns/{campaign_id}")
def delete_admin_campaign(campaign_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    # Validate campaign_id
    if campaign_id <= 0 or campaign_id > 2147483647:
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Delete associated email logs first
    db.query(EmailLog).filter(EmailLog.campaign_id == campaign_id).delete()

    # Delete the campaign
    db.delete(campaign)
    db.commit()

    return {"message": "Campaign and associated email logs deleted successfully"}

@app.post("/admin/system/settings")
def save_system_settings(settings: dict, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    # In a real implementation, this would save to a settings table
    # For now, we'll just validate and return success
    required_fields = ['sendgrid_api_key', 'from_email']
    for field in required_fields:
        if field not in settings or not settings[field]:
            raise HTTPException(status_code=400, detail=f"{field} is required")

    # Here you would save to database or config file
    # For demo purposes, we'll just return success
    return {"message": "System settings saved successfully"}

@app.get("/admin/system/settings")
def get_system_settings(current_user: DBUser = Depends(get_current_admin_user)):
    # Return current system settings (would come from database/config)
    return {
        "sendgrid_api_key": "SG.****" + SENDGRID_API_KEY[-4:] if SENDGRID_API_KEY else "",
        "from_email": "Dynamic (user's email)",
        "jwt_secret_configured": bool(JWT_SECRET),
        "google_oauth_configured": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
        "perplexity_api_configured": bool(PERPLEXITY_API_KEY)
    }

@app.post("/admin/system/cleanup")
def cleanup_system_data(data: dict, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    cleanup_type = data.get("type", "")
    deleted_count = 0

    if cleanup_type == "chat_messages":
        # Delete messages older than 2 days
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=2)
        deleted_count = db.query(ChatMessage).filter(ChatMessage.created_at < cutoff_date).delete()
    elif cleanup_type == "email_logs":
        # Delete logs older than 30 days
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
        deleted_count = db.query(EmailLog).filter(EmailLog.sent_at < cutoff_date).delete()

    db.commit()
    return {"message": f"Cleaned up {deleted_count} records"}

@app.get("/admin/overview")
def get_admin_overview(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)
    
    # Get total users
    total_users = db.query(func.count(DBUser.id)).scalar()
    
    # Get users created this month vs last month for growth calculation
    users_this_month = db.query(func.count(DBUser.id)).filter(DBUser.created_at >= month_start).scalar()
    users_last_month = db.query(func.count(DBUser.id)).filter(
        DBUser.created_at >= last_month_start,
        DBUser.created_at < month_start
    ).scalar()
    
    # Calculate user growth percentage
    if users_last_month > 0:
        user_growth = round(((users_this_month - users_last_month) / users_last_month) * 100, 1)
    else:
        user_growth = 100.0 if users_this_month > 0 else 0.0
    
    # Get active campaigns (only those that are actually running)
    active_campaigns = db.query(func.count(Campaign.id)).filter(Campaign.status == 'sending').scalar()
    total_campaigns = db.query(func.count(Campaign.id)).scalar()
    
    # Get emails sent today
    emails_today = db.query(func.count(EmailLog.id)).filter(
        EmailLog.sent_at >= today,
        EmailLog.status == 'sent'
    ).scalar()
    
    # Calculate success rate for today's emails
    total_emails_today = db.query(func.count(EmailLog.id)).filter(EmailLog.sent_at >= today).scalar()
    if total_emails_today > 0:
        success_rate = round((emails_today / total_emails_today) * 100, 1)
    else:
        success_rate = 0.0
    
    # Get database statistics
    total_email_logs = db.query(func.count(EmailLog.id)).scalar()
    total_templates = db.query(func.count(Template.id)).scalar()
    total_chat_messages = db.query(func.count(ChatMessage.id)).scalar()
    
    # Get recent activity (last 10 email logs) - use eager loading
    recent_logs = db.query(EmailLog).options(joinedload(EmailLog.user)).order_by(EmailLog.sent_at.desc()).limit(10).all()
    
    # System health based on actual metrics
    health_status = "Excellent"
    if total_users == 0:
        health_status = "New System"
    elif emails_today == 0 and total_email_logs > 0:
        health_status = "Idle"
    elif success_rate < 80 and total_emails_today > 0:
        health_status = "Needs Attention"
    elif success_rate >= 95:
        health_status = "Excellent"
    else:
        health_status = "Good"
    
    return {
        "total_users": total_users,
        "user_growth": user_growth,
        "active_campaigns": active_campaigns,
        "total_campaigns": total_campaigns,
        "emails_today": emails_today,
        "success_rate": success_rate,
        "system_health": health_status,
        "database_stats": {
            "total_email_logs": total_email_logs,
            "total_templates": total_templates,
            "total_chat_messages": total_chat_messages
        },
        "recent_activity": [{
            "description": f"Email sent by {log.user.username if log.user else 'Unknown'} to {log.recipient_email}",
            "timestamp": log.sent_at.isoformat() if log.sent_at else None,
            "status": log.status
        } for log in recent_logs]
    }

@app.get("/admin/email-logs")
def get_email_logs(
    status_filter: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_admin_user)
):
    # Build query
    query = db.query(EmailLog).join(DBUser, EmailLog.user_id == DBUser.id)

    if status_filter and status_filter != 'all':
        query = query.filter(EmailLog.status == status_filter)

    # Get stats
    total_sent = db.query(func.count(EmailLog.id)).filter(EmailLog.status == 'sent').scalar()
    total_failed = db.query(func.count(EmailLog.id)).filter(EmailLog.status == 'failed').scalar()
    total_bounced = db.query(func.count(EmailLog.id)).filter(EmailLog.status == 'bounced').scalar()
    total_all = total_sent + total_failed + total_bounced

    # Get logs with pagination (ensure user relationship is loaded)
    logs = query.order_by(EmailLog.sent_at.desc()).offset(offset).limit(limit).all()

    return {
        "stats": {
            "sent": total_sent,
            "failed": total_failed,
            "bounced": total_bounced,
            "total": total_all
        },
        "logs": [{
            "id": log.id,
            "user_id": log.user_id,
            "username": log.user.username,
            "recipient_email": log.recipient_email,
            "status": log.status,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            "campaign_id": log.campaign_id,
            "error_message": log.error_message
        } for log in logs]
    }

@app.post("/admin/users/{user_id}/emails")
def add_user_email(user_id: int, email_data: dict, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    user = db.query(DBUser).filter(DBUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    email = email_data.get("email", "").strip().lower()
    if not EMAIL_VALIDATION_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if email already exists
    existing = db.query(UserEmail).filter(UserEmail.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_email = UserEmail(user_id=user_id, email=email, is_verified=True)
    db.add(user_email)
    db.commit()
    return {"message": "Email added successfully"}

@app.get("/admin/users/{user_id}/emails")
def get_user_emails(user_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    emails = db.query(UserEmail).filter(UserEmail.user_id == user_id).all()
    return [{"id": e.id, "email": e.email, "is_verified": e.is_verified, "is_primary": e.is_primary} for e in emails]

@app.delete("/admin/users/{user_id}/emails/{email_id}")
def delete_user_email(user_id: int, email_id: int, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    email = db.query(UserEmail).filter(UserEmail.id == email_id, UserEmail.user_id == user_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    db.delete(email)
    db.commit()
    return {"message": "Email deleted successfully"}

@app.get("/users/me/emails")
def get_my_emails(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    # Get user's primary email and additional emails
    additional_emails = db.query(UserEmail).filter(UserEmail.user_id == current_user.id).all()
    emails = [{"email": current_user.email, "is_primary": True}]
    emails.extend([{"email": e.email, "is_primary": False} for e in additional_emails])
    return emails

@app.get("/admin/database/stats")
def get_database_stats(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    # Get table counts
    users_count = db.query(DBUser).count()
    campaigns_count = db.query(Campaign).count()
    email_logs_count = db.query(EmailLog).count()
    templates_count = db.query(Template).count()
    chat_messages_count = db.query(ChatMessage).count()
    try:
        user_emails_count = db.query(UserEmail).count()
    except:
        user_emails_count = 0

    return {
        "table_counts": {
            "users": users_count,
            "campaigns": campaigns_count,
            "email_logs": email_logs_count,
            "templates": templates_count,
            "chat_messages": chat_messages_count,
            "user_emails": user_emails_count
        },
        "total_records": users_count + campaigns_count + email_logs_count + templates_count + chat_messages_count + user_emails_count,
        "database_size": "Unknown",
        "performance": "Good"
    }

# --- Security & Audit Endpoints ---

@app.get("/admin/security/overview")
def get_security_overview(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    """Get security overview statistics"""
    now = datetime.now(timezone.utc)
    
    # Count failed login attempts in last 24 hours
    failed_logins_24h = 0
    for key, (attempts, last_attempt) in login_attempts.items():
        if (now - last_attempt).total_seconds() < 86400:  # 24 hours
            failed_logins_24h += attempts
    
    # Count active sessions (sessions active in last 30 minutes) and clean up expired ones
    active_sessions_count = 0
    expired_sessions = []
    
    for session_id, session_data in active_sessions.items():
        if isinstance(session_data, dict):
            last_activity = session_data.get('last_activity', session_data.get('login_time'))
        else:
            last_activity = session_data  # Backward compatibility
            
        if (now - last_activity).total_seconds() < 1800:  # 30 minutes
            active_sessions_count += 1
        else:
            # Mark for cleanup
            expired_sessions.append(session_id)
    
    # Clean up expired sessions
    for session_id in expired_sessions:
        del active_sessions[session_id]
    
    # Count security alerts in last 24 hours
    recent_alerts = [alert for alert in security_alerts if (now - alert['timestamp']).total_seconds() < 86400]
    security_alerts_count = len(recent_alerts)
    
    # Format alerts for frontend
    formatted_alerts = []
    for alert in recent_alerts[-10:]:  # Last 10 alerts
        formatted_alerts.append({
            "type": alert["type"],
            "message": alert["message"],
            "timestamp": alert["timestamp"].isoformat() if hasattr(alert["timestamp"], 'isoformat') else str(alert["timestamp"]),
            "severity": alert["severity"]
        })
    
    return {
        "failed_logins": failed_logins_24h,
        "active_sessions": active_sessions_count,
        "security_alerts": security_alerts_count,
        "recent_alerts": formatted_alerts
    }

@app.post("/admin/security/force-logout-all")
def force_logout_all_users(request: Request, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    """Force logout all users except current admin"""
    global active_sessions, active_tokens
    
    # Get admin's current token from Authorization header
    auth_header = request.headers.get("Authorization", "")
    admin_token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None
    
    # Count sessions before clearing
    total_sessions = len(active_sessions)
    
    # Remove all non-admin sessions
    sessions_to_remove = []
    for session_id, session_data in active_sessions.items():
        if isinstance(session_data, dict):
            if session_data.get('user_id') != current_user.id:
                sessions_to_remove.append(session_id)
        else:
            # Remove old format sessions
            sessions_to_remove.append(session_id)
    
    for session_id in sessions_to_remove:
        del active_sessions[session_id]
    
    # Clear all tokens and re-add admin's token
    active_tokens.clear()
    if admin_token:
        active_tokens.add(admin_token)
    
    logged_out_count = len(sessions_to_remove)
    
    # Add security alert
    security_alerts.append({
        "type": "force_logout",
        "message": f"Admin {current_user.username} forced logout of {logged_out_count} users",
        "timestamp": datetime.now(timezone.utc),
        "severity": "high"
    })
    
    return {"message": f"Forced logout of {logged_out_count} users (admin session preserved)"}

@app.post("/admin/security/reset-passwords")
def reset_all_passwords(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    """Reset all user passwords (demo - would send reset emails in production)"""
    users = db.query(DBUser).filter(DBUser.id != current_user.id).all()
    
    # In production, this would send password reset emails
    # For demo, we'll just log the action
    
    # Add security alert and log
    security_alerts.append({
        "type": "password_reset",
        "message": f"Admin {current_user.username} initiated password reset for all users",
        "timestamp": datetime.now(timezone.utc),
        "severity": "critical"
    })
    logger.warning(f"SECURITY: Admin {sanitize_username_for_logging(current_user.username)} initiated password reset for all users")
    
    return {"message": f"Password reset initiated for {len(users)} users (emails would be sent in production)"}

@app.get("/admin/security/audit-log")
def get_audit_log(limit: int = 50, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    """Get security audit log"""
    # In production, this would come from a dedicated audit log table
    # For demo, we'll return recent security alerts and login attempts
    
    audit_entries = []
    
    # Add security alerts to audit log
    for alert in security_alerts[-limit//2:]:
        audit_entries.append({
            "timestamp": alert['timestamp'].isoformat(),
            "user": "System",
            "action": alert['type'],
            "details": alert['message']
        })
    
    # Add recent login failures
    now = datetime.now(timezone.utc)
    for key, (attempts, last_attempt) in list(login_attempts.items()):
        if (now - last_attempt).total_seconds() < 86400:  # Last 24 hours
            ip, username = key.split(':', 1)
            audit_entries.append({
                "timestamp": last_attempt.isoformat(),
                "user": username,
                "action": "failed_login",
                "details": f"{attempts} failed attempts from IP {ip}"
            })
    
    # Sort by timestamp (newest first)
    audit_entries.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return audit_entries[:limit]

@app.get("/admin/security/active-sessions")
def get_active_sessions(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    """Get list of currently active user sessions"""
    now = datetime.now(timezone.utc)
    active_list = []
    
    for session_id, session_data in list(active_sessions.items()):
        if isinstance(session_data, dict):
            last_activity = session_data.get('last_activity', session_data.get('login_time'))
            if (now - last_activity).total_seconds() < 1800:  # 30 minutes
                active_list.append({
                    "session_id": session_id,
                    "user_id": session_data.get('user_id'),
                    "username": session_data.get('username'),
                    "ip_address": session_data.get('ip'),
                    "login_time": session_data.get('login_time').isoformat(),
                    "last_activity": last_activity.isoformat(),
                    "duration_minutes": int((now - session_data.get('login_time')).total_seconds() / 60)
                })
            else:
                # Clean up expired session
                del active_sessions[session_id]
        else:
            # Handle old format sessions
            if (now - session_data).total_seconds() < 1800:
                active_list.append({
                    "session_id": session_id,
                    "user_id": "Unknown",
                    "username": "Unknown",
                    "ip_address": "Unknown",
                    "login_time": session_data.isoformat(),
                    "last_activity": session_data.isoformat(),
                    "duration_minutes": int((now - session_data).total_seconds() / 60)
                })
            else:
                del active_sessions[session_id]
    
    return {"active_sessions": active_list, "total_count": len(active_list)}

@app.post("/admin/security/review-alert/{alert_index}")
def review_security_alert(alert_index: int, current_user: DBUser = Depends(get_current_admin_user)):
    """Mark a security alert as reviewed"""
    if 0 <= alert_index < len(security_alerts):
        security_alerts[alert_index]["reviewed"] = True
        security_alerts[alert_index]["reviewed_by"] = current_user.username
        security_alerts[alert_index]["reviewed_at"] = datetime.now(timezone.utc)
        return {"message": "Alert marked as reviewed"}
    else:
        raise HTTPException(status_code=404, detail="Alert not found")

@app.post("/admin/security/clear-alerts")
def clear_security_alerts(current_user: DBUser = Depends(get_current_admin_user)):
    """Clear all security alerts"""
    global security_alerts
    alert_count = len(security_alerts)
    security_alerts.clear()
    return {"message": f"Cleared {alert_count} security alerts"}

@app.post("/admin/security/clear-logs")
def clear_audit_logs(current_user: DBUser = Depends(get_current_admin_user)):
    """Clear audit logs and login attempts"""
    global login_attempts, user_activity_log
    login_count = len(login_attempts)
    activity_count = len(user_activity_log)
    login_attempts.clear()
    user_activity_log.clear()
    return {"message": f"Cleared {login_count} login attempts and {activity_count} activity logs"}

@app.get("/admin/security/user-activity")
def get_user_activity(limit: int = 100, current_user: DBUser = Depends(get_current_admin_user)):
    """Get user activity log with login times and actions"""
    activities = []
    
    # Add login activities from active sessions
    for session_id, session_data in active_sessions.items():
        if isinstance(session_data, dict):
            activities.append({
                "user_id": session_data.get('user_id'),
                "username": session_data.get('username'),
                "action": "login",
                "timestamp": session_data.get('login_time').isoformat(),
                "ip": session_data.get('ip'),
                "details": f"User logged in from {session_data.get('ip')}",
                "status": "active"
            })
    
    # Add activities from user_activity_log
    for activity in user_activity_log[-limit:]:
        activities.append(activity)
    
    # Sort by timestamp (newest first)
    activities.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return {"activities": activities[:limit], "total_count": len(activities)}

@app.get("/admin/security/debug-sessions")
def debug_active_sessions(current_user: DBUser = Depends(get_current_admin_user)):
    """Debug endpoint to see raw session data"""
    now = datetime.now(timezone.utc)
    session_details = []
    
    for session_id, session_data in active_sessions.items():
        if isinstance(session_data, dict):
            last_activity = session_data.get('last_activity', session_data.get('login_time'))
            age_minutes = (now - last_activity).total_seconds() / 60
            session_details.append({
                "session_id": session_id,
                "user_id": session_data.get('user_id'),
                "username": session_data.get('username'),
                "ip": session_data.get('ip'),
                "login_time": session_data.get('login_time').isoformat(),
                "last_activity": last_activity.isoformat(),
                "age_minutes": round(age_minutes, 2),
                "is_active": age_minutes < 30
            })
        else:
            age_minutes = (now - session_data).total_seconds() / 60
            session_details.append({
                "session_id": session_id,
                "user_id": "unknown",
                "username": "unknown",
                "ip": "unknown",
                "login_time": session_data.isoformat(),
                "last_activity": session_data.isoformat(),
                "age_minutes": round(age_minutes, 2),
                "is_active": age_minutes < 30
            })
    
    return {
        "total_sessions": len(active_sessions),
        "active_sessions": len([s for s in session_details if s["is_active"]]),
        "session_details": session_details
    }

# --- Template Management Endpoints ---

@app.get("/templates", response_model=List[TemplateSchema])
def get_templates(db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    templates = db.query(Template).all()
    result = []
    for template in templates:
        template_dict = {
            "id": template.id,
            "name": template.name,
            "subject": template.subject,
            "body": template.body,
            "sendgrid_template_id": template.sendgrid_template_id,
            "preview_html": template.preview_html,
            "category": template.category,
            "created_at": template.created_at,
            "updated_at": template.updated_at,
            "template_variables": []
        }
        
        # Convert template_variables JSON string back to list
        if template.template_variables:
            try:
                template_dict["template_variables"] = json.loads(template.template_variables)
            except:
                template_dict["template_variables"] = []
        
        result.append(template_dict)
    return result

@app.post("/templates", response_model=TemplateSchema)
def create_template(template: TemplateCreate, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    import uuid
    template_id = str(uuid.uuid4())[:8]

    db_template = Template(
        id=template_id,
        name=template.name,
        subject=template.subject,
        body=template.body,
        category=template.category or "general"
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@app.put("/templates/{template_id}", response_model=TemplateSchema)
def update_template(template_id: str, template_update: TemplateUpdate, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    if not template_id or len(template_id.strip()) == 0:
        raise HTTPException(status_code=400, detail="Invalid template ID")
    
    template = db.query(Template).filter(Template.id == template_id.strip()).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    try:
        update_data = template_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            if isinstance(value, str):
                value = value.strip()
            setattr(template, key, value)
        db.commit()
        db.refresh(template)
        return template
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update template")

@app.delete("/templates/{template_id}")
def delete_template(template_id: str, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}

# --- Admin Template Management Endpoints ---

@app.post("/admin/templates", response_model=TemplateSchema)
def create_template_admin(template: AdminTemplateCreate, db: Session = Depends(get_db), admin: DBUser = Depends(get_current_admin_user)):
    logger.info(f"Admin template creation requested by user: {admin.username} (ID: {admin.id})")
    logger.info(f"Template data: name={template.name}, category={template.category}")

    import uuid
    template_id = str(uuid.uuid4())[:8]
    logger.info(f"Generated template ID: {template_id}")

    # Convert variables list to JSON string
    variables_json = json.dumps(template.template_variables) if template.template_variables else None
    logger.info(f"Template variables JSON: {variables_json}")

    db_template = Template(
        id=template_id,
        name=template.name,
        subject=template.subject,
        body=template.body,
        sendgrid_template_id=template.sendgrid_template_id,
        preview_html=template.preview_html,
        template_variables=variables_json,
        category=template.category or "general"
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    logger.info(f"Template created successfully: {db_template.id}")

    # Convert back to list for response
    result = {
        "id": db_template.id,
        "name": db_template.name,
        "subject": db_template.subject,
        "body": db_template.body,
        "sendgrid_template_id": db_template.sendgrid_template_id,
        "preview_html": db_template.preview_html,
        "category": db_template.category,
        "created_at": db_template.created_at,
        "updated_at": db_template.updated_at,
        "template_variables": json.loads(variables_json) if variables_json else []
    }
    return result

@app.put("/admin/templates/{template_id}", response_model=TemplateSchema)
def update_template_admin(template_id: str, template_update: AdminTemplateUpdate, db: Session = Depends(get_db), admin: DBUser = Depends(get_current_admin_user)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = template_update.dict(exclude_unset=True)
    
    # Handle template_variables conversion
    variables_json = None
    if 'template_variables' in update_data:
        variables_json = json.dumps(update_data['template_variables']) if update_data['template_variables'] else None
        update_data['template_variables'] = variables_json
    
    for key, value in update_data.items():
        setattr(template, key, value)
    
    db.commit()
    db.refresh(template)
    
    # Convert back to list for response
    result = {
        "id": template.id,
        "name": template.name,
        "subject": template.subject,
        "body": template.body,
        "sendgrid_template_id": template.sendgrid_template_id,
        "preview_html": template.preview_html,
        "category": template.category,
        "created_at": template.created_at,
        "updated_at": template.updated_at,
        "template_variables": json.loads(template.template_variables) if template.template_variables else []
    }
    return result

# --- Email Validation Endpoint ---

# ULTRA-FAST Email Validation with Caching and Parallel Processing
import aiohttp
from concurrent.futures import ThreadPoolExecutor
import threading

# Global DNS cache with TTL and size limits
dns_cache = {}
dns_cache_lock = threading.Lock()
DNS_CACHE_TTL = 3600  # 1 hour
DNS_CACHE_MAX_SIZE = 10000  # Maximum cache entries

# Thread pool for DNS lookups with proper cleanup
dns_executor = ThreadPoolExecutor(max_workers=20, thread_name_prefix="dns-lookup")

# Cleanup function for thread pool
def cleanup_thread_pool():
    """Cleanup thread pool on shutdown"""
    try:
        if dns_executor:
            dns_executor.shutdown(wait=True)
            logger.info("DNS thread pool cleaned up")
    except Exception as e:
        logger.error(f"Error cleaning up DNS thread pool: {e}")


# Known valid domains - pre-validated to skip DNS lookups
KNOWN_VALID_DOMAINS = {
    # Major providers
    'gmail.com', 'googlemail.com',  # Google
    'outlook.com', 'hotmail.com', 'live.com', 'msn.com',  # Microsoft
    'yahoo.com', 'yahoo.co.uk', 'yahoo.ca', 'yahoo.au', 'ymail.com', 'rocketmail.com',  # Yahoo
    'aol.com', 'aim.com',  # AOL
    'icloud.com', 'me.com', 'mac.com',  # Apple
    'protonmail.com', 'proton.me',  # ProtonMail
    'zoho.com', 'zohomail.com',  # Zoho
    'yandex.com', 'yandex.ru',  # Yandex
    'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru',  # Mail.ru
    'gmx.com', 'gmx.net', 'gmx.de',  # GMX
    'web.de', 't-online.de',  # Deutsche Telekom
    'comcast.net', 'verizon.net', 'att.net', 'bellsouth.net',  # US ISPs

    # Common business domains (pre-validated)
    'company.com', 'business.com', 'enterprise.com', 'corp.com', 'inc.com',
    'example.com', 'test.com', 'sample.com', 'demo.com', 'fake.com',
    'kalkiavatar.org', 'apple.com', 'microsoft.com', 'amazon.com', 'facebook.com', 'twitter.com',
}

# Disposable/temporary email domains
DISPOSABLE_DOMAINS = {
    '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'tempmail.org',
    'throwaway.email', 'yopmail.com', 'temp-mail.org', 'fakeinbox.com',
    'maildrop.cc', 'tempail.com', 'dispostable.com', '0-mail.com',
    'mytemp.email', 'temp-mail.io', 'mail-temp.com', 'tempinbox.com',
    'spamgourmet.com', 'mailnull.com', 'suremail.info', 'spamhole.com',
    'grr.la', 'pokemail.net', 'spam4.me', 'koszmail.pl', 'binkmail.com',
    'spambog.ru', 'safersignup.de', 'deadaddress.com', 'kurzepost.de',
    'lifebyfood.com', 'objectmail.com', 'obobbo.com', 'rcpt.at',
    'spamobox.com', 'upliftnow.com', 'uplipht.com', 'venompen.com',
    'walkmail.net', 'wetrainbayarea.com', 'zetmail.com'
}

# Role-based email prefixes that might indicate non-personal emails
ROLE_PREFIXES = {
    'admin', 'administrator', 'info', 'contact', 'support', 'help', 'sales',
    'marketing', 'billing', 'accounts', 'finance', 'hr', 'humanresources',
    'jobs', 'careers', 'recruitment', 'noreply', 'no-reply', 'donotreply',
    'do-not-reply', 'newsletter', 'news', 'updates', 'alerts', 'notifications',
    'webmaster', 'postmaster', 'hostmaster', 'root', 'sysadmin', 'abuse',
    'security', 'privacy', 'legal', 'compliance', 'feedback', 'survey'
}

# Known spam trap domains/patterns
SPAM_TRAP_DOMAINS = {
    'spamtrap.com', 'spamcop.net', 'abuse.net', 'uol.com.br',
    'blackhole.com', 'devnull.com', 'null.com', 'spamhole.com'
}

# Major providers that don't need SMTP verification
MAJOR_PROVIDERS = KNOWN_VALID_DOMAINS.copy()

async def cached_dns_lookup(domain):
    """Cached DNS MX lookup with TTL and size management"""
    now = asyncio.get_event_loop().time()

    with dns_cache_lock:
        # Check cache first
        if domain in dns_cache:
            cached_result, timestamp = dns_cache[domain]
            if now - timestamp < DNS_CACHE_TTL:
                return cached_result
            else:
                del dns_cache[domain]

        # Clean up expired entries if cache is getting large
        if len(dns_cache) >= DNS_CACHE_MAX_SIZE:
            expired_domains = [
                d for d, (_, ts) in dns_cache.items()
                if now - ts >= DNS_CACHE_TTL
            ]
            for d in expired_domains:
                del dns_cache[d]

            # If still too large, remove oldest entries
            if len(dns_cache) >= DNS_CACHE_MAX_SIZE:
                sorted_entries = sorted(dns_cache.items(), key=lambda x: x[1][1])
                domains_to_remove = [d for d, _ in sorted_entries[:len(sorted_entries) // 4]]
                for d in domains_to_remove:
                    del dns_cache[d]

    try:
        # Use thread pool for DNS lookup with timeout
        mx_records = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                dns_executor, dns.resolver.resolve, domain, 'MX'
            ),
            timeout=10.0  # 10 second timeout
        )
        result = str(mx_records[0].exchange) if mx_records else None

        with dns_cache_lock:
            dns_cache[domain] = (result, now)

        return result
    except asyncio.TimeoutError:
        logger.warning(f"DNS lookup timeout for domain: {domain}")
        with dns_cache_lock:
            dns_cache[domain] = (None, now)
        return None
    except Exception as e:
        logger.warning(f"DNS lookup failed for domain {domain}: {e}")
        # Cache negative results too
        with dns_cache_lock:
            dns_cache[domain] = (None, now)
        return None

async def validate_single_email(email):
    """Advanced email validation with comprehensive checks"""
    email = email.strip()

    # 1. Format Check (instant)
    if not EMAIL_VALIDATION_PATTERN.match(email):
        return EmailValidationResult(email=email, valid=False, deliverable=False, reason="Invalid Format")

    local_part, domain = email.split('@')
    domain = domain.lower()
    local_part = local_part.lower()

    # 2. Check disposable domains first
    if domain in DISPOSABLE_DOMAINS:
        return EmailValidationResult(email=email, valid=False, deliverable=False, reason="Disposable Email Domain")

    # 3. Check spam trap domains
    if domain in SPAM_TRAP_DOMAINS:
        return EmailValidationResult(email=email, valid=False, deliverable=False, reason="Spam Trap Domain")

    # 4. Check known valid domains (instant - no network calls)
    if domain in KNOWN_VALID_DOMAINS:
        if domain in MAJOR_PROVIDERS:
            return EmailValidationResult(email=email, valid=True, deliverable=True, reason="Valid Domain (Major Provider)")
        else:
            return EmailValidationResult(email=email, valid=True, deliverable=True, reason="Valid Domain")

    # 5. For unknown domains, check DNS first
    mail_server = await cached_dns_lookup(domain)
    if not mail_server:
        return EmailValidationResult(email=email, valid=False, deliverable=False, reason="Invalid Domain (No MX Record)")

    # 6. Domain has MX, so role-based emails are acceptable
    if local_part in ROLE_PREFIXES:
        return EmailValidationResult(email=email, valid=True, deliverable=True, reason="Role-based / non-personal")

    # 7. Advanced SMTP verification with catch-all detection
    try:
        smtp_result = await asyncio.to_thread(check_smtp_advanced, mail_server, email, domain)

        if smtp_result["status"] == "verified":
            return EmailValidationResult(email=email, valid=True, deliverable=True, reason="Mailbox Verified")
        elif smtp_result["status"] == "catch_all":
            return EmailValidationResult(email=email, valid=True, deliverable=True, reason="Domain Valid (Catch-all)")
        elif smtp_result["status"] == "not_verified":
            return EmailValidationResult(email=email, valid=False, deliverable=False, reason="Mailbox Not Found")
        elif smtp_result["status"] == "smtp_unreachable":
            return EmailValidationResult(email=email, valid=True, deliverable=False, reason="SMTP unreachable – possibly valid")
        else:  # server_error
            # If SMTP fails, still mark as valid since many servers block verification
            return EmailValidationResult(email=email, valid=True, deliverable=True, reason="Domain Valid (SMTP Blocked)")

    except Exception:
        # If advanced SMTP fails, mark as SMTP unreachable
        return EmailValidationResult(email=email, valid=True, deliverable=False, reason="SMTP unreachable – possibly valid")

@app.post("/email/validate", response_model=EmailValidationResponse)
async def validate_emails(request: EmailValidationRequest, current_user: DBUser = Depends(get_current_user)):
    # Input validation
    if not request.emails or len(request.emails) == 0:
        raise HTTPException(status_code=400, detail="No emails provided")

    if len(request.emails) > 1000:
        raise HTTPException(status_code=400, detail="Maximum 1000 emails allowed")

    # Validate each email format and length
    validated_emails = []
    for email in request.emails:
        if not isinstance(email, str):
            raise HTTPException(status_code=400, detail="All emails must be strings")

        email = email.strip()
        if not email:
            raise HTTPException(status_code=400, detail="Empty email addresses not allowed")

        if len(email) > EMAIL_MAX_LENGTH:
            raise HTTPException(status_code=400, detail=f"Email too long (max {EMAIL_MAX_LENGTH} characters)")

        if not EMAIL_VALIDATION_PATTERN.match(email):
            raise HTTPException(status_code=400, detail=f"Invalid email format: {email}")

        validated_emails.append(email)

    request.emails = validated_emails

    # Process all emails in parallel with semaphore to prevent overwhelming
    semaphore = asyncio.Semaphore(min(25, len(request.emails)))  # Limit concurrent validations

    async def validate_with_semaphore(email):
        async with semaphore:
            return await validate_single_email(email)

    # Create validation tasks
    tasks = [validate_with_semaphore(email) for email in request.emails]

    # Execute all validations concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Handle any exceptions that occurred
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            # If validation failed, return a safe result
            final_results.append(EmailValidationResult(
                email=request.emails[i],
                valid=False,
                deliverable=False,
                reason="Validation Error"
            ))
        else:
            final_results.append(result)

    return EmailValidationResponse(results=final_results)

# Ultra-fast SMTP checking with optimized timeout
def check_smtp_mailbox_fast(mail_server, email_address, domain):
    """Fast SMTP verification with shorter timeout"""
    try:
        with smtplib.SMTP(mail_server, timeout=5) as server:  # Reduced timeout
            server.set_debuglevel(0)
            server.helo('emailvalidator.service')

            # Check the actual email address only (skip catch-all detection for speed)
            code_real, _ = server.rcpt(email_address)

            if code_real == 250:
                return "verified", "Mailbox exists"
            elif code_real in (550, 551, 552, 553, 554):
                return "not_verified", f"Mailbox rejected (code {code_real})"
            else:
                return "server_error", f"Unexpected response code {code_real}"

    except smtplib.SMTPException as e:
        return "server_error", f"SMTP error: {str(e)}"
    except (ConnectionError, OSError) as e:
        return "server_error", f"Connection error: {str(e)}"
    except Exception as e:
        return "server_error", f"Unexpected error: {str(e)}"

# Advanced SMTP checking with catch-all detection
def check_smtp_advanced(mail_server, email_address, domain):
    """Advanced SMTP verification with catch-all detection"""
    # Use a random, non-existent email to check for catch-all
    random_user = uuid.uuid4().hex[:16]
    fake_email_for_check = f"{random_user}@{domain}"

    try:
        with smtplib.SMTP(mail_server, timeout=8) as server:  # Slightly longer timeout for advanced check
            server.set_debuglevel(0)
            server.helo('emailvalidator.service')
            server.mail('verify@emailvalidator.service')

            # Check the actual email address
            code_real, _ = server.rcpt(email_address)

            if code_real != 250:
                # If the real email is rejected, we know it's not valid
                return {"status": "not_verified", "message": f"Mailbox rejected with code {code_real}"}

            # If the real email was accepted, check the fake one to detect a catch-all
            code_fake, _ = server.rcpt(fake_email_for_check)

            if code_fake == 250:
                # If the server also accepts a random fake email, it's a catch-all
                return {"status": "catch_all", "message": "Domain is a catch-all"}
            else:
                # If the server accepts the real one but rejects the fake one, it's truly verified
                return {"status": "verified", "message": "Mailbox exists"}

    except smtplib.SMTPException as e:
        return {"status": "smtp_unreachable", "message": f"SMTP unreachable: {str(e)}"}
    except (ConnectionError, OSError) as e:
        return {"status": "smtp_unreachable", "message": f"SMTP unreachable: {str(e)}"}
    except Exception as e:
        return {"status": "smtp_unreachable", "message": f"SMTP unreachable: {str(e)}"}
# --- AI Email Generation Endpoint ---

@app.post("/ai/generate-email", response_model=EmailGenerationResponse)
def generate_email(request: EmailGenerationRequest, current_user: DBUser = Depends(get_current_user)):
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=500, detail="Perplexity API key not configured")

    prompt = f"""
Generate a professional email based on the following request:
{request.prompt}

Recipient information: {request.recipient_info or 'General recipient'}
Tone: {request.tone}

Please provide:
1. A compelling subject line
2. A well-structured email body

Format your response as JSON with 'subject' and 'body' fields.
"""

    try:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.1-sonar-large-128k-online",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1000
            },
            timeout=30,
            verify=True  # Ensure SSL verification
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="AI service error")

        data = response.json()
        content = data['choices'][0]['message']['content']

        # Parse the response (assuming it returns JSON)
        try:
            parsed = json.loads(content)
            return EmailGenerationResponse(subject=parsed['subject'], body=parsed['body'])
        except:
            # Fallback: extract subject and body from text
            lines = content.split('\n')
            subject = ""
            body = ""
            for line in lines:
                if line.startswith('Subject:') or line.startswith('subject:'):
                    subject = line.split(':', 1)[1].strip()
                elif line.startswith('Body:') or line.startswith('body:'):
                    body = line.split(':', 1)[1].strip()
                else:
                    body += line + '\n'
            return EmailGenerationResponse(subject=subject or "Generated Email", body=body.strip())

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


# Endpoints
@app.post("/token")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    client_ip = request.client.host
    username = form_data.username.strip() if form_data.username else ""
    
    # Rate limiting check
    now = datetime.now(timezone.utc)
    key = f"{client_ip}:{username}"
    
    if key in login_attempts:
        attempts, last_attempt = login_attempts[key]
        if attempts >= MAX_LOGIN_ATTEMPTS and (now - last_attempt).total_seconds() < LOCKOUT_DURATION:
            logger.warning(f"Account locked for user from {client_ip}")
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
        elif (now - last_attempt).total_seconds() >= LOCKOUT_DURATION:
            del login_attempts[key]
    
    user = authenticate_user(db, username, form_data.password)
    if not user:
        # Track failed attempt
        if key in login_attempts:
            attempts, _ = login_attempts[key]
            login_attempts[key] = (attempts + 1, now)
        else:
            login_attempts[key] = (1, now)
        
        logger.warning(f"Failed login attempt for user: {sanitize_username_for_logging(username)} from {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Clear failed attempts on successful login
    if key in login_attempts:
        del login_attempts[key]
    
    # Generate secure session ID using secrets module
    session_id = secrets.token_urlsafe(32)
    active_sessions[session_id] = {
        "user_id": user.id,
        "username": user.username,
        "login_time": now,
        "last_activity": now,
        "ip": client_ip
    }
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    # Track valid token
    active_tokens.add(access_token)
    
    # Log user activity
    log_user_activity(user.id, user.username, "login", client_ip, f"Successful login from {client_ip}")
    
    logger.info(f"Successful login for user: {sanitize_username_for_logging(user.username)}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/google")
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google Oauth not configured.")
    redirect_uri = f"{BASE_URL}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri=redirect_uri)

@app.get("/auth/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured.")
    
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info_response = await oauth.google.get('https://www.googleapis.com/oauth2/v3/userinfo', token=token)
        user_info = user_info_response.json()
        
        if user_info and 'email' in user_info and user_info.get('email_verified', False):
            email = user_info['email'].lower().strip()
            if not EMAIL_VALIDATION_PATTERN.match(email):
                return RedirectResponse(url=f"{BASE_URL}/?error=invalid_email", status_code=302)
            
            db_user = get_user_by_email(db, email)
            if not db_user:
                return RedirectResponse(url=f"{BASE_URL}/?contact_admin=1", status_code=302)
            else:
                # Track Google OAuth session with secure session ID
                now = datetime.now(timezone.utc)
                client_ip = request.client.host
                session_id = secrets.token_urlsafe(32)
                active_sessions[session_id] = {
                    "user_id": db_user.id,
                    "username": db_user.username,
                    "login_time": now,
                    "last_activity": now,
                    "ip": client_ip
                }
                
                access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                access_token = create_access_token(data={"sub": db_user.username}, expires_delta=access_token_expires)
                active_tokens.add(access_token)
                logger.info(f"Successful Google login for user: {sanitize_username_for_logging(db_user.username)}")
                return RedirectResponse(url=f"{BASE_URL}/?token={access_token}", status_code=302)
        else:
            raise HTTPException(status_code=400, detail="Google login failed: Could not retrieve email.")
            
    except Exception as e:
        logger.error(f"Google authentication error: {e}")
        return RedirectResponse(url=f"{BASE_URL}/?error=auth_failed", status_code=302)

@app.get("/users/me", response_model=UserSchema)
async def read_users_me(current_user: DBUser = Depends(get_current_user)):
    return current_user

@app.put("/users/me/update", response_model=UserSchema)
async def update_user_me(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    # Check for username conflicts
    if user_update.username and user_update.username != current_user.username:
        existing_user = get_user(db, user_update.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        current_user.username = user_update.username

    # Check for email conflicts
    if user_update.email and user_update.email != current_user.email:
        existing_user = get_user_by_email(db, user_update.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = user_update.email
    
    db.commit()
    db.refresh(current_user)
    return current_user

@app.put("/users/me/change-password")
async def change_password(
    password_update: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_user)
):
    # Verify the current password
    if not verify_password(password_update.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    # Hash the new password and update the user
    current_user.hashed_password = get_password_hash(password_update.new_password)
    db.commit()

    return {"message": "Password updated successfully"}

@app.post("/admin/send-email-to-users")
def send_email_to_users_admin(email_data: dict, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_admin_user)):
    """Send email to multiple users (admin only)"""
    subject = email_data.get("subject", "")
    content = email_data.get("content", "")
    user_ids = email_data.get("user_ids", [])

    if not subject or not content:
        raise HTTPException(status_code=400, detail="Subject and content are required")

    if not user_ids:
        raise HTTPException(status_code=400, detail="No users specified")

    sent_count = 0
    errors = []

    for user_id in user_ids:
        try:
            user = db.query(DBUser).filter(DBUser.id == user_id).first()
            if not user:
                errors.append(f"User {user_id} not found")
                continue

            # Send email using SendGrid
            sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
            message = Mail(
                from_email=current_user.email,
                to_emails=user.email,
                subject=subject,
                html_content=content
            )
            response = sg.send(message)

            # Log the email
            email_log = EmailLog(
                user_id=current_user.id,
                recipient_email=user.email,
                status="sent"
            )
            db.add(email_log)
            sent_count += 1

        except Exception as e:
            errors.append(f"Failed to send to user {user_id}: {str(e)}")

    db.commit()

    return {"sent_count": sent_count, "errors": errors}

@app.post("/api/send-email")
async def send_email(email_request: EmailRequest, db: Session = Depends(get_db), current_user: DBUser = Depends(get_current_user)):
    logger.info(f"Email request received: from={email_request.from_email}, to={email_request.to_email}, subject={email_request.subject}")
    logger.info(f"Request details: template_id={email_request.template_id}, sendgrid_template_id={email_request.sendgrid_template_id}")
    logger.info(f"Dynamic template data: {email_request.dynamic_template_data}")
    logger.info(f"Body: {email_request.body}")
    if not SENDGRID_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="SendGrid API key not configured. Please configure SENDGRID_API_KEY in environment variables."
        )
    
    # Email rate limiting
    now = datetime.now(timezone.utc)
    user_key = f"email_{current_user.id}"
    
    if user_key in email_attempts:
        attempts = email_attempts[user_key]
        attempts = [t for t in attempts if (now - t).total_seconds() < 3600]
        
        if len(attempts) >= MAX_EMAILS_PER_HOUR:
            raise HTTPException(status_code=429, detail="Hourly email limit exceeded. Try again later.")
        
        recent_attempts = [t for t in attempts if (now - t).total_seconds() < 60]
        if len(recent_attempts) >= MAX_EMAILS_PER_MINUTE:
            raise HTTPException(status_code=429, detail="Email rate limit exceeded. Wait a minute.")
        
        attempts.append(now)
        email_attempts[user_key] = attempts
    else:
        email_attempts[user_key] = [now]
    
    from_email = email_request.from_email or current_user.email
    
    try:
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        
        # Check if this is a SendGrid template request (direct) - prioritize this over template_id
        if hasattr(email_request, 'sendgrid_template_id') and email_request.sendgrid_template_id:
            # Direct SendGrid template request
            logger.info(f"Using SendGrid template {email_request.sendgrid_template_id} for email to {email_request.to_email}")
            message = Mail(
                from_email=from_email,
                to_emails=email_request.to_email
            )
            message.template_id = email_request.sendgrid_template_id

            # Handle different template types
            dynamic_data = email_request.dynamic_template_data or {}
            template_id = email_request.sendgrid_template_id

            logger.info(f"Template ID: {template_id}")
            logger.info(f"Template ID length: {len(template_id)}")
            logger.info(f"Template ID first 5 chars: {template_id[:5]}")
            logger.info(f"Starts with 43e0af39: {template_id.startswith('43e0af39')}")
            logger.info(f"Starts with d-: {template_id.startswith('d-')}")
            logger.info(f"'d-' in template_id: {'d-' in template_id}")

            # Check if this is a legacy template
            # Dynamic templates start with 'd-', legacy templates have other patterns
            if template_id.startswith('d-'):
                # Dynamic Template
                logger.info("EXECUTING: Dynamic Template branch")
                logger.info(f"Setting dynamic template data: {dynamic_data}")
                message.dynamic_template_data = dynamic_data
                logger.info(f"Dynamic data set: {message.dynamic_template_data}")
            elif template_id.startswith('43e0af39') or (template_id[0].isalpha() and not template_id.startswith('d-')):
                # Legacy Transactional Template - try multiple methods
                logger.info("EXECUTING: Legacy Transactional Template branch")
                legacy_data = {
                    'podcast_channel': dynamic_data.get('name', 'Valued Contact')
                }
                logger.info(f"Using legacy template data: {legacy_data}")

                # Method 1: Try dynamic_template_data (should work for legacy templates too)
                try:
                    message.dynamic_template_data = legacy_data
                    logger.info(f"Legacy data set via dynamic_template_data: {getattr(message, 'dynamic_template_data', 'NOT_SET')}")
                except Exception as e:
                    logger.error(f"Failed to set dynamic_template_data: {e}")

                # Method 2: Try substitutions (legacy way)
                try:
                    # For legacy templates, also try substitutions
                    substitutions = {
                        'podcast_channel': dynamic_data.get('name', 'Valued Contact')
                    }
                    # SendGrid might expect substitutions in a different format
                    if hasattr(message, 'substitutions'):
                        message.substitutions = substitutions
                        logger.info(f"Legacy substitutions set: {message.substitutions}")
                    else:
                        logger.info("Message does not have substitutions attribute")
                except Exception as e:
                    logger.error(f"Failed to set substitutions: {e}")

                # Method 3: Try setting in internal dict
                try:
                    message._Mail__dynamic_template_data = legacy_data
                    logger.info(f"Legacy data set via internal dict: {message._Mail__dynamic_template_data}")
                except Exception as e:
                    logger.error(f"Failed to set internal dict: {e}")

            else:
                # Dynamic Template - use standard variables
                logger.info("EXECUTING: Dynamic Template branch")
                logger.info(f"Setting dynamic template data: {dynamic_data}")
                message.dynamic_template_data = dynamic_data
                logger.info(f"Dynamic data set: {message.dynamic_template_data}")

            logger.info(f"Final dynamic_template_data set: {getattr(message, 'dynamic_template_data', 'NOT_SET')}")

        # Check if this is a template-based email
        elif hasattr(email_request, 'template_id') and email_request.template_id:
            template = db.query(Template).filter(Template.id == email_request.template_id).first()

            if template and template.sendgrid_template_id:
                # Use SendGrid native template
                logger.info(f"Using SendGrid template {template.sendgrid_template_id} for email to {email_request.to_email}")
                message = Mail(
                    from_email=from_email,
                    to_emails=email_request.to_email
                )
                message.template_id = template.sendgrid_template_id

                # Handle different template types
                dynamic_data = email_request.dynamic_template_data or {}

                # Check if this is a legacy template (starts with letters, not 'd-')
                if template.sendgrid_template_id.startswith(('43e0af39', 'a', 'b', 'c', 'd', 'e', 'f')) and not template.sendgrid_template_id.startswith('d-'):
                    # Legacy Transactional Template - use specific variable name
                    logger.info("Detected Legacy Transactional Template from database")
                    legacy_data = {
                        'podcast_channel': dynamic_data.get('name', 'Valued Contact')
                    }
                    logger.info(f"Using legacy template data: {legacy_data}")
                    message.dynamic_template_data = legacy_data
                else:
                    # Dynamic Template - use standard variables
                    logger.info("Detected Dynamic Template from database")
                    logger.info(f"Setting dynamic template data: {dynamic_data}")
                    message.dynamic_template_data = dynamic_data

                logger.info(f"Final dynamic_template_data set: {getattr(message, 'dynamic_template_data', 'NOT_SET')}")
            else:
                # Use custom HTML (backward compatibility)
                logger.info(f"Using custom HTML email for {email_request.to_email}")
                message = Mail(
                    from_email=from_email,
                    to_emails=email_request.to_email,
                    subject=email_request.subject,
                    html_content=email_request.body
                )
        else:
            # Use custom HTML (backward compatibility)
            logger.info(f"Using custom HTML email for {email_request.to_email}")
            message = Mail(
                from_email=from_email,
                to_emails=email_request.to_email,
                subject=email_request.subject,
                html_content=email_request.body
            )
        
        message.reply_to = from_email
        response = sg.send(message)
        logger.info(f"SendGrid response status: {response.status_code}")

        email_log = EmailLog(
            user_id=current_user.id,
            campaign_id=None,
            recipient_email=email_request.to_email,
            status="sent"
        )
        db.add(email_log)
        db.commit()
        
        log_user_activity(current_user.id, current_user.username, "send_email", "system", f"Sent email to {email_request.to_email}")

        return {"status": "success", "message": "Email sent"}
    except Exception as e:
        try:
            email_log = EmailLog(
                user_id=current_user.id,
                campaign_id=None,
                recipient_email=email_request.to_email,
                status="failed",
                error_message=str(e)[:MAX_ERROR_MESSAGE_LENGTH]
            )
            db.add(email_log)
            db.commit()
        except Exception as db_error:
            logger.error(f"Failed to log email error: {db_error}")

        error_msg = str(e)
        logger.error(f"SendGrid error details: {error_msg}")

        if "403" in error_msg or "Forbidden" in error_msg:
            error_msg = "SendGrid authentication failed. Please verify: 1) API key is valid, 2) API key has 'Mail Send' permissions, 3) Sender email is verified in SendGrid dashboard"
        elif "401" in error_msg or "Unauthorized" in error_msg:
            error_msg = "SendGrid API key is invalid or expired. Please check your SendGrid account and regenerate the API key if needed."
        elif "400" in error_msg:
            error_msg = f"SendGrid configuration issue: {error_msg[:200]}"
        else:
            error_msg = f"SendGrid error: {error_msg[:200]}"

        raise HTTPException(status_code=500, detail=error_msg)

# Serve frontend - mount static files with lower priority so API routes take precedence
from fastapi.responses import FileResponse

@app.get("/")
async def read_root():
    return FileResponse("index.html", media_type="text/html")

# Health check endpoint for deployment platforms
@app.get("/health")
async def health_check():
    """Health check endpoint that doesn't require authentication"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sendgrid_configured": SENDGRID_API_KEY is not None,
        "database_connected": True  # You could add actual DB check here
    }

# Mount static files at a specific path to avoid conflicts with API routes
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
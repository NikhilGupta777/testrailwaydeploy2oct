from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, CheckConstraint, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    email = Column(String(254), unique=True, index=True, nullable=False)
    role = Column(String(20), default="user", nullable=False)  # 'admin' or 'user'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'user')", name="check_valid_role"),
        CheckConstraint("length(username) >= 3", name="check_username_length"),
        CheckConstraint("length(email) <= 254", name="check_email_length"),
    )

class Template(Base):
    __tablename__ = "templates"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    subject = Column(String)
    body = Column(Text)  # Keep for backward compatibility
    sendgrid_template_id = Column(String, nullable=True)  # SendGrid template ID
    preview_html = Column(Text, nullable=True)  # Static HTML preview
    template_variables = Column(Text, nullable=True)  # JSON string of variables
    category = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    template_id = Column(String, ForeignKey("templates.id"), nullable=False)  # Changed to String to match templates.id
    sender_email = Column(String(254), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(20), default="completed", nullable=False)  # 'draft', 'sending', 'completed', 'failed'

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'sending', 'completed', 'failed')", name="check_campaign_status"),
        CheckConstraint("length(name) > 0", name="check_campaign_name_not_empty"),
    )

    # Relationships
    user = relationship("User", backref="campaigns")
    template = relationship("Template", backref="campaigns")

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Add user_id for individual emails
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    recipient_email = Column(String(254), nullable=False)
    status = Column(String(20), default="sent", nullable=False)  # 'sent', 'failed', 'bounced'
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    error_message = Column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("status IN ('sent', 'failed', 'bounced')", name="check_email_status"),
        CheckConstraint("(user_id IS NOT NULL) OR (campaign_id IS NOT NULL)", name="check_user_or_campaign"),
    )

    # Relationships
    user = relationship("User", backref="email_logs")
    campaign = relationship("Campaign", backref="email_logs")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null for global messages
    room_id = Column(String, nullable=True)  # For grouping conversations (can be user-user or global)
    message = Column(Text, nullable=False)
    message_type = Column(String, default="text")  # 'text', 'system', etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_messages")
    recipient = relationship("User", foreign_keys=[recipient_id], backref="received_messages")

class UserEmail(Base):
    __tablename__ = "user_emails"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    email = Column(String(254), nullable=False, index=True)
    is_verified = Column(Boolean, default=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("length(email) <= 254", name="check_user_email_length"),
    )

    # Relationships
    user = relationship("User", backref="user_emails")
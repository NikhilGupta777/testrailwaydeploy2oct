# Railway Deployment Guide

## Prerequisites
1. Install Railway CLI: `npm install -g @railway/cli`
2. Create Railway account at https://railway.app
3. Login: `railway login`

## Database Setup
1. In Railway dashboard, create a PostgreSQL database
2. Copy the DATABASE_URL from Railway dashboard

## Deployment Steps

### 1. Initialize Railway Project
```bash
railway init
```

### 2. Set Environment Variables
```bash
# Required variables
railway variables set DATABASE_URL="your_postgresql_url_from_railway"
railway variables set SENDGRID_API_KEY="your_sendgrid_api_key"
railway variables set JWT_SECRET="your_secure_jwt_secret"

# Optional variables
railway variables set GOOGLE_CLIENT_ID="your_google_client_id"
railway variables set GOOGLE_CLIENT_SECRET="your_google_client_secret"
railway variables set PERPLEXITY_API_KEY="your_perplexity_api_key"

# Production URLs (update after first deployment)
railway variables set ALLOWED_ORIGINS="https://your-app.railway.app"
railway variables set BASE_URL="https://your-app.railway.app"
```

### 3. Deploy
```bash
railway up
```

### 4. Update URLs After First Deployment
After first deployment, Railway will give you a domain like `your-app.railway.app`:
```bash
railway variables set ALLOWED_ORIGINS="https://your-app.railway.app,https://localhost:8000"
railway variables set BASE_URL="https://your-app.railway.app"
```

### 5. Update Google OAuth (if using)
In Google Cloud Console, add your Railway domain to authorized redirect URIs:
- `https://your-app.railway.app/auth/google/callback`

## Important Notes
- Railway automatically sets the PORT environment variable
- The app will be accessible at your Railway domain
- Database tables will be created automatically on first run
- Static files are served from the `/static` directory
- Health check endpoint: `/users/me`

## Troubleshooting
- Check logs: `railway logs`
- Check variables: `railway variables`
- Redeploy: `railway up --detach`
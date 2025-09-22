# AWS Elastic Beanstalk Deployment Guide

## Prerequisites
1. AWS Account with appropriate permissions
2. Python 3.11+ installed
3. Git installed

## Quick Deployment (Automated)
```bash
# Run the deployment script
deploy-aws.bat
```

## Manual Deployment Steps

### 1. Install AWS EB CLI
```bash
pip install awsebcli
```

### 2. Initialize EB Application
```bash
eb init
# Select:
# - Region: us-east-1 (or your preferred region)
# - Platform: Python 3.11
# - Application name: email-automation
```

### 3. Create Environment
```bash
eb create email-automation-prod --instance-type t3.micro
```

### 4. Set Environment Variables
Go to AWS EB Console → Configuration → Environment Properties and add:

**Required:**
- `DATABASE_URL`: Your PostgreSQL connection string
- `SENDGRID_API_KEY`: Your SendGrid API key
- `SENDGRID_FROM_EMAIL`: Your verified sender email
- `JWT_SECRET`: Random secret key for JWT tokens

**Optional:**
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: https://your-app.elasticbeanstalk.com/auth/google/callback
- `PERPLEXITY_API_KEY`: Perplexity AI API key
- `BASE_URL`: https://your-app.elasticbeanstalk.com

### 5. Deploy Application
```bash
eb deploy
```

### 6. Open Application
```bash
eb open
```

## Database Setup
Your PostgreSQL database (Neon) is already configured. The app will automatically create tables on first run.

## Create Admin User
After deployment, create an admin user by running:
```bash
eb ssh
cd /var/app/current
python create_test_user.py
```

Default login: `admin` / `admin123`

## Monitoring
- View logs: `eb logs`
- Check health: `eb health`
- Monitor in AWS Console

## Troubleshooting
1. **Database Connection Issues**: Verify DATABASE_URL is correct
2. **Email Not Sending**: Check SendGrid API key and verified sender
3. **Google OAuth Issues**: Verify redirect URI matches deployment URL
4. **Static Files**: Ensure index.html is in root directory

## Cost Optimization
- Use t3.micro for development (free tier eligible)
- Scale up to t3.small+ for production
- Consider using RDS for database if needed

## Security Notes
- All sensitive data is in environment variables
- HTTPS is automatically enabled by EB
- Database uses SSL connection
- JWT tokens expire in 30 minutes
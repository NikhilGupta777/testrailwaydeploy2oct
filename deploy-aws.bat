@echo off
echo ========================================
echo AWS Elastic Beanstalk Deployment Script
echo ========================================

echo.
echo Step 1: Installing AWS EB CLI...
pip install awsebcli

echo.
echo Step 2: Initializing EB application...
eb init --platform python-3.11 --region us-east-1

echo.
echo Step 3: Creating EB environment...
eb create email-automation-prod --instance-type t3.micro

echo.
echo Step 4: Setting environment variables...
echo Please set these environment variables in AWS EB Console:
echo - DATABASE_URL
echo - SENDGRID_API_KEY  
echo - SENDGRID_FROM_EMAIL
echo - JWT_SECRET
echo - GOOGLE_CLIENT_ID (optional)
echo - GOOGLE_CLIENT_SECRET (optional)
echo - GOOGLE_REDIRECT_URI (optional)
echo - PERPLEXITY_API_KEY (optional)
echo - BASE_URL

echo.
echo Step 5: Deploying application...
eb deploy

echo.
echo Step 6: Opening application...
eb open

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
pause
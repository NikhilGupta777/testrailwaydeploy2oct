#!/usr/bin/env python3
"""
SendGrid API Key Test Script
Tests if the SendGrid API key is valid and working
"""

import os
import sys
from dotenv import load_dotenv
import sendgrid
from sendgrid.helpers.mail import Mail

# Load environment variables
load_dotenv()

# Get API key
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")

def test_sendgrid_key():
    """Test the SendGrid API key"""
    if not SENDGRID_API_KEY:
        print("ERROR: SENDGRID_API_KEY not found in environment variables")
        return False

    print(f"PASS: API Key found (length: {len(SENDGRID_API_KEY)})")
    print(f"PASS: API Key format: {SENDGRID_API_KEY[:10]}...")

    # Check if key format looks correct
    if not SENDGRID_API_KEY.startswith("SG."):
        print("ERROR: API key doesn't start with 'SG.'")
        return False

    try:
        # Initialize SendGrid client
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        print("PASS: SendGrid client initialized successfully")

        # Test API key by getting account info (this doesn't send an email)
        response = sg.client.user.get()
        print(f"PASS: API Key is valid! Status: {response.status_code}")

        if response.status_code == 200:
            user_data = response.to_dict
            print(f"PASS: Account: {user_data.get('username', 'Unknown')}")
            return True
        else:
            print(f"ERROR: API Key issue - Status: {response.status_code}")
            print(f"Response: {response.body}")
            return False

    except Exception as e:
        print(f"ERROR: {str(e)}")

        if "401" in str(e) or "Unauthorized" in str(e):
            print("ERROR: This is a 401 Unauthorized error - your API key is invalid or expired")
        elif "403" in str(e) or "Forbidden" in str(e):
            print("ERROR: This is a 403 Forbidden error - your API key doesn't have 'Mail Send' permissions")
        elif "429" in str(e):
            print("ERROR: This is a 429 error - too many requests")

        return False

if __name__ == "__main__":
    print("Testing SendGrid API Key...")
    print("=" * 50)

    success = test_sendgrid_key()

    print("=" * 50)
    if success:
        print("SUCCESS: API Key test PASSED!")
        print("\nYour SendGrid API key is working correctly.")
        print("The issue might be elsewhere in your application.")
    else:
        print("FAILED: API Key test FAILED!")
        print("\nPlease check:")
        print("1. Go to https://app.sendgrid.com/settings/api_keys")
        print("2. Verify your API key is active and not expired")
        print("3. Ensure the key has 'Mail Send' permissions")
        print("4. Check your SendGrid account billing status")
        print("5. Generate a new API key if needed")

    sys.exit(0 if success else 1)
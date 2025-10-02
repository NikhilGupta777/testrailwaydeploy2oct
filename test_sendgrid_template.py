#!/usr/bin/env python3
"""
Test script to send a SendGrid template email
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_sendgrid_template():
    print("Testing SendGrid template email sending...")

    # First, login to get token
    login_response = requests.post(f"{BASE_URL}/token", data={
        "username": "admin",
        "password": "admin123"
    })

    if login_response.status_code != 200:
        print(f"Login failed: {login_response.status_code} - {login_response.text}")
        return

    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test sending SendGrid template email
    email_data = {
        "from_email": "admin@kalkiavatar.org",
        "to_email": "heygencreator@gmail.com",
        "subject": "Test SendGrid Template",
        "sendgrid_template_id": "d3bc53d7-2704-472a-be18-56f9f34c254a",
        "dynamic_template_data": {
            "name": "Test User",
            "email": "heygencreator@gmail.com",
            "organization": "Test Organization"
        }
    }

    print(f"Sending email with data: {json.dumps(email_data, indent=2)}")

    response = requests.post(
        f"{BASE_URL}/api/send-email",
        headers=headers,
        json=email_data
    )

    print(f"Response status: {response.status_code}")
    print(f"Response body: {response.text}")

    if response.status_code == 200:
        print("✅ Email sent successfully!")
    else:
        print("❌ Email sending failed")

if __name__ == "__main__":
    test_sendgrid_template()
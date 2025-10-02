#!/usr/bin/env python3
"""
Test script to verify template functionality
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_templates():
    print("Testing template endpoints...")
    
    # Test getting templates (should work without auth for testing)
    try:
        response = requests.get(f"{BASE_URL}/templates")
        print(f"GET /templates: {response.status_code}")
        if response.status_code == 200:
            templates = response.json()
            print(f"Found {len(templates)} templates")
            for template in templates:
                print(f"  - {template.get('name', 'Unknown')} (ID: {template.get('id', 'Unknown')})")
                if template.get('sendgrid_template_id'):
                    print(f"    SendGrid ID: {template['sendgrid_template_id']}")
                if template.get('template_variables'):
                    print(f"    Variables: {template['template_variables']}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing templates: {e}")

if __name__ == "__main__":
    test_templates()
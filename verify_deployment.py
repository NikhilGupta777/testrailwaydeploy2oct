#!/usr/bin/env python3
"""
Railway Deployment Verification Script
Checks if the project is ready for Railway deployment
"""

import os
import sys
from pathlib import Path

def check_file_exists(file_path, description):
    """Check if a file exists and print status"""
    if Path(file_path).exists():
        print(f"OK {description}: {file_path}")
        return True
    else:
        print(f"MISSING {description}: {file_path}")
        return False

def check_env_vars():
    """Check critical environment variables"""
    print("\nChecking Environment Variables:")
    
    required_vars = [
        ("DATABASE_URL", "PostgreSQL connection string"),
        ("SENDGRID_API_KEY", "SendGrid API key"),
        ("JWT_SECRET", "JWT secret key")
    ]
    
    optional_vars = [
        ("GOOGLE_CLIENT_ID", "Google OAuth client ID"),
        ("GOOGLE_CLIENT_SECRET", "Google OAuth client secret"),
        ("PERPLEXITY_API_KEY", "Perplexity AI API key")
    ]
    
    all_good = True
    
    for var, desc in required_vars:
        value = os.getenv(var)
        if value:
            print(f"OK {desc}: Set (length: {len(value)})")
        else:
            print(f"MISSING {desc}: NOT SET - REQUIRED")
            all_good = False
    
    for var, desc in optional_vars:
        value = os.getenv(var)
        if value:
            print(f"OK {desc}: Set (length: {len(value)})")
        else:
            print(f"OPTIONAL {desc}: Not set")
    
    return all_good

def check_python_syntax():
    """Check if main Python files have valid syntax"""
    print("\nChecking Python Syntax:")
    
    files_to_check = ["main.py", "database.py", "models.py", "schemas.py"]
    all_good = True
    
    for file in files_to_check:
        try:
            with open(file, 'r', encoding='utf-8') as f:
                compile(f.read(), file, 'exec')
            print(f"OK {file}: Valid syntax")
        except SyntaxError as e:
            print(f"ERROR {file}: Syntax error - {e}")
            all_good = False
        except FileNotFoundError:
            print(f"MISSING {file}: File not found")
            all_good = False
    
    return all_good

def main():
    print("Railway Deployment Verification")
    print("=" * 50)
    
    # Check required files
    print("\nChecking Required Files:")
    files_ok = True
    
    required_files = [
        ("main.py", "Main FastAPI application"),
        ("requirements.txt", "Python dependencies"),
        ("Procfile", "Railway process definition"),
        ("railway.toml", "Railway configuration"),
        ("database.py", "Database configuration"),
        ("models.py", "SQLAlchemy models"),
        ("schemas.py", "Pydantic schemas"),
        (".env", "Environment variables"),
        ("index.html", "Frontend HTML"),
        ("static/", "Static files directory")
    ]
    
    for file_path, description in required_files:
        if not check_file_exists(file_path, description):
            files_ok = False
    
    # Check environment variables
    env_ok = check_env_vars()
    
    # Check Python syntax
    syntax_ok = check_python_syntax()
    
    # Final verdict
    print("\n" + "=" * 50)
    print("DEPLOYMENT READINESS SUMMARY:")
    print("=" * 50)
    
    if files_ok and env_ok and syntax_ok:
        print("SUCCESS: PROJECT IS READY FOR RAILWAY DEPLOYMENT!")
        print("\nNext steps:")
        print("1. Run: railway login")
        print("2. Run: railway init")
        print("3. Create PostgreSQL database in Railway dashboard")
        print("4. Set environment variables: railway variables set KEY=value")
        print("5. Deploy: railway up")
        return 0
    else:
        print("ERROR: PROJECT HAS ISSUES - FIX BEFORE DEPLOYING")
        if not files_ok:
            print("- Fix missing files")
        if not env_ok:
            print("- Set required environment variables")
        if not syntax_ok:
            print("- Fix Python syntax errors")
        return 1

if __name__ == "__main__":
    sys.exit(main())
#!/usr/bin/env python3
"""
Comprehensive verification script for the SendGrid template implementation
"""
import json
from sqlalchemy import text
from database import engine, SessionLocal
from models import Template

def verify_database():
    """Verify database schema has the new columns"""
    print("🔍 Verifying database schema...")
    
    with engine.connect() as conn:
        try:
            # Check if new columns exist
            result = conn.execute(text("PRAGMA table_info(templates)"))
            columns = [row[1] for row in result.fetchall()]
            
            required_columns = ['sendgrid_template_id', 'preview_html', 'template_variables']
            missing_columns = [col for col in required_columns if col not in columns]
            
            if missing_columns:
                print(f"❌ Missing columns: {missing_columns}")
                return False
            else:
                print("✅ All required columns exist")
                return True
                
        except Exception as e:
            print(f"❌ Database error: {e}")
            return False

def verify_models():
    """Verify the Template model has the new fields"""
    print("\n🔍 Verifying Template model...")
    
    try:
        # Check if Template model has the new attributes
        template_attrs = dir(Template)
        required_attrs = ['sendgrid_template_id', 'preview_html', 'template_variables']
        missing_attrs = [attr for attr in required_attrs if attr not in template_attrs]
        
        if missing_attrs:
            print(f"❌ Missing model attributes: {missing_attrs}")
            return False
        else:
            print("✅ Template model has all required fields")
            return True
            
    except Exception as e:
        print(f"❌ Model error: {e}")
        return False

def verify_template_creation():
    """Test creating a template with SendGrid fields"""
    print("\n🔍 Testing template creation...")
    
    db = SessionLocal()
    try:
        # Create a test template
        test_template = Template(
            id="test-sg-template",
            name="Test SendGrid Template",
            subject="Test Subject",
            body="Test body",
            sendgrid_template_id="d-1234567890abcdef",
            preview_html="<h1>Test Preview</h1>",
            template_variables=json.dumps(["name", "email", "company"]),
            category="test"
        )
        
        db.add(test_template)
        db.commit()
        
        # Retrieve and verify
        retrieved = db.query(Template).filter(Template.id == "test-sg-template").first()
        if retrieved:
            print("✅ Template creation successful")
            print(f"   SendGrid ID: {retrieved.sendgrid_template_id}")
            print(f"   Preview HTML: {retrieved.preview_html[:50]}...")
            print(f"   Variables: {retrieved.template_variables}")
            
            # Clean up
            db.delete(retrieved)
            db.commit()
            return True
        else:
            print("❌ Template not found after creation")
            return False
            
    except Exception as e:
        print(f"❌ Template creation error: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def verify_json_conversion():
    """Test JSON conversion for template variables"""
    print("\n🔍 Testing JSON conversion...")
    
    try:
        # Test data
        variables = ["name", "email", "company"]
        json_string = json.dumps(variables)
        converted_back = json.loads(json_string)
        
        if variables == converted_back:
            print("✅ JSON conversion working correctly")
            return True
        else:
            print("❌ JSON conversion failed")
            return False
            
    except Exception as e:
        print(f"❌ JSON conversion error: {e}")
        return False

def verify_files():
    """Verify all required files exist and have the right content"""
    print("\n🔍 Verifying file modifications...")
    
    files_to_check = {
        'models.py': ['sendgrid_template_id', 'preview_html', 'template_variables'],
        'schemas.py': ['AdminTemplateCreate', 'AdminTemplateUpdate'],
        'main.py': ['/admin/templates', 'createTemplateAdmin', 'updateTemplateAdmin'],
        'static/js/templates.js': ['isAdmin', 'createAdminModal', 'showAdminCreateModal'],
        'static/js/auth.js': ['getCurrentUser'],
        'static/js/api.js': ['createTemplateAdmin', 'updateTemplateAdmin']
    }
    
    all_good = True
    for filename, required_content in files_to_check.items():
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                content = f.read()
                
            missing_content = [item for item in required_content if item not in content]
            if missing_content:
                print(f"❌ {filename}: Missing {missing_content}")
                all_good = False
            else:
                print(f"✅ {filename}: All required content present")
                
        except FileNotFoundError:
            print(f"❌ {filename}: File not found")
            all_good = False
        except Exception as e:
            print(f"❌ {filename}: Error reading file - {e}")
            all_good = False
    
    return all_good

def main():
    """Run all verification tests"""
    print("🚀 Starting SendGrid Template Implementation Verification\n")
    
    tests = [
        ("Database Schema", verify_database),
        ("Template Model", verify_models),
        ("Template Creation", verify_template_creation),
        ("JSON Conversion", verify_json_conversion),
        ("File Modifications", verify_files)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name}: Unexpected error - {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*50)
    print("📊 VERIFICATION SUMMARY")
    print("="*50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Implementation is ready.")
        print("\n📋 Next steps:")
        print("1. Start the FastAPI server: python -m uvicorn main:app --reload")
        print("2. Login as admin user")
        print("3. Go to Templates section")
        print("4. Create a new template with SendGrid Template ID")
        print("5. Test email sending with the new template")
    else:
        print(f"\n⚠️  {total - passed} tests failed. Please fix the issues above.")
    
    return passed == total

if __name__ == "__main__":
    main()
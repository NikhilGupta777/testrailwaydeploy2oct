from sqlalchemy import text
from database import engine

def migrate_templates():
    """Add SendGrid template support columns to templates table"""
    with engine.connect() as conn:
        try:
            # Add new columns for SendGrid template support
            conn.execute(text("ALTER TABLE templates ADD COLUMN sendgrid_template_id VARCHAR"))
            print("Added sendgrid_template_id column")
        except Exception as e:
            print(f"sendgrid_template_id column may already exist: {e}")
        
        try:
            conn.execute(text("ALTER TABLE templates ADD COLUMN preview_html TEXT"))
            print("Added preview_html column")
        except Exception as e:
            print(f"preview_html column may already exist: {e}")
        
        try:
            conn.execute(text("ALTER TABLE templates ADD COLUMN template_variables TEXT"))
            print("Added template_variables column")
        except Exception as e:
            print(f"template_variables column may already exist: {e}")
        
        conn.commit()
        print("SendGrid template migration completed successfully")

if __name__ == "__main__":
    migrate_templates()
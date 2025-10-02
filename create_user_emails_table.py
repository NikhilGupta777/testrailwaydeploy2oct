from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

# Create user_emails table
create_table_sql = """
CREATE TABLE IF NOT EXISTS user_emails (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_user_email_length CHECK (length(email) <= 254)
);

CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_email ON user_emails(email);
"""

try:
    with engine.connect() as conn:
        conn.execute(text(create_table_sql))
        conn.commit()
        print("user_emails table created successfully!")
except Exception as e:
    print(f"Error creating table: {e}")
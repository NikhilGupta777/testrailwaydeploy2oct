#!/usr/bin/env python3
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

def check_schema():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is required")

    engine = create_engine(database_url)
    with engine.connect() as conn:
        try:
            # Check if chat_messages table exists
            result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name = 'chat_messages';"))
            if result.fetchone():
                print("chat_messages table exists")

                # Check columns
                result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_messages' ORDER BY ordinal_position;"))
                columns = [row[0] for row in result]
                print("Columns in chat_messages table:")
                for col in columns:
                    print(f"  - {col}")

                expected_columns = ['id', 'sender_id', 'recipient_id', 'room_id', 'message', 'message_type', 'created_at', 'is_read']
                missing_columns = [col for col in expected_columns if col not in columns]
                if missing_columns:
                    print(f"Missing columns: {missing_columns}")
                else:
                    print("All expected columns present")
            else:
                print("chat_messages table does not exist")

        except Exception as e:
            print(f"Error checking schema: {e}")

if __name__ == "__main__":
    check_schema()
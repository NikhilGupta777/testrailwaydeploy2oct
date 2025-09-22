"""
Google App Engine entry point
"""
from main import app

# GAE expects this
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
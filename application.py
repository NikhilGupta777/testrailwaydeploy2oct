"""
AWS Elastic Beanstalk entry point
EB expects 'application' variable
"""
from main import app

# EB expects this exact variable name
application = app

if __name__ == "__main__":
    application.run(debug=False)
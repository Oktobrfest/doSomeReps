"""Class-based Flask app configuration."""
from os import environ, path


# import sys
# sys.path.append('/home/ubuntu/projects/venv/lib/python3.10/site-packages/python-dotenv')
# sys.path.append('/home/ubuntu/projects/venv/lib/python3.10/site-packages/dotenv')
from dotenv import load_dotenv
# # load_dotenv()
# from dotenv import load_dotenv
# load_dotenv()

basedir = path.abspath(path.dirname(__file__))
load_dotenv(path.join(basedir, ".env"))


class Config:
    """Configuration from environment variables."""

    SECRET_KEY = environ.get("SECRET_KEY")
    FLASK_ENV = environ.get("FLASK_ENV")
    FLASK_APP = "wsgi.py"

    # Static Assets
    STATIC_FOLDER = "static"
    TEMPLATES_FOLDER = "templates"
    COMPRESSOR_DEBUG = True
    
    #file uploads
    UPLOADS_DEFAULT_DEST = 'repz/home/static' 
    UPLOAD_FOLDER = 'repz/home/static'
    UPLOADED_IMAGES_DEST = 'repz/home/static'
    
    #s3
    ACCESS_KEY_ID = environ.get("ACCESS_KEY_ID")
    SECRET_ACCESS_KEY = environ.get("SECRET_ACCESS_KEY")
    BUCKET = environ.get("BUCKET")
    S3_LOCATION = f"http://{BUCKET}.s3.amazonaws.com/"
    
    # These are the allowed file types, edit this part to fit your needs
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'svg'}


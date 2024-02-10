"""Class-based Flask app configuration."""
from os import environ, path
import logging
import sys

from dotenv import load_dotenv

basedir = path.abspath(path.dirname(__file__))
load_dotenv(path.join(basedir, ".env"))


class Config:
    """Configuration from environment variables."""

    SECRET_KEY = environ.get("SECRET_KEY")
    FLASK_ENV = environ.get("FLASK_ENV")
    FLASK_APP = "wsgi.py"
    
    #included to be able to step into other modules
   # set in docker-compose or .env DEBUG = True
    DEBUG_TB_INTERCEPT_REDIRECTS = False

    # Static Assets
    STATIC_FOLDER = "static"
    TEMPLATES_FOLDER = "templates"
    COMPRESSOR_DEBUG = True
    
    # file uploads
    UPLOADS_DEFAULT_DEST = 'repz/home/static' 
    UPLOAD_FOLDER = 'repz/home/static'
    UPLOADED_IMAGES_DEST = 'repz/home/static'
    
    # s3
    ACCESS_KEY_ID = environ.get("ACCESS_KEY_ID")
    SECRET_ACCESS_KEY = environ.get("SECRET_ACCESS_KEY")
    BUCKET = environ.get("BUCKET")
    S3_LOCATION = f"http://{BUCKET}.s3.amazonaws.com/"

    # database
    DB_ADDRESS=environ.get("DB_ADDRESS")
    DB_NAME=environ.get("DB_NAME")
    DB_USERNAME=environ.get("DB_USERNAME")
    DB_PASSWORD=environ.get("DB_PASSWORD")
    
    # These are the allowed file types, edit this part to fit your needs
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'svg'}

    # Configure SQLAlchemy logging
    logging.basicConfig()
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.orm').setLevel(logging.WARNING)

    # Redirect SQLAlchemy logs to stdout
    logging.getLogger('sqlalchemy.engine').addHandler(logging.StreamHandler(sys.stdout))
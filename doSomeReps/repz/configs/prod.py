from .config import Config
import logging
import sys

from os import environ, path
from dotenv import load_dotenv


BASE_DIR = path.abspath(path.join(path.dirname(__file__), '..', '..'))

class ProdConfig(Config):
    
    load_dotenv(path.join(BASE_DIR, "prod.env"), override=True)
    
    SECRET_KEY = environ.get("SECRET_KEY")
    FLASK_ENV = environ.get("FLASK_ENV", "production")
    
    APP_DIR = environ.get('APP_DIR', 'repz')
    # Static Assets
    STATIC_FOLDER = environ.get("STATIC_FOLDER", "static")
    TEMPLATES_FOLDER = environ.get('TEMPLATES_FOLDER', 'templates')
    COMPRESSOR_DEBUG = environ.get("COMPRESSOR_DEBUG", False)
    # file uploads
    UPLOADS_DEFAULT_DEST = environ.get("UPLOADS_DEFAULT_DEST", f'{APP_DIR}/{STATIC_FOLDER}') 
    UPLOAD_FOLDER = environ.get("UPLOAD_FOLDER", UPLOADS_DEFAULT_DEST) 
    UPLOADED_IMAGES_DEST = environ.get("UPLOADED_IMAGES_DEST", UPLOADS_DEFAULT_DEST) 
    ALLOWED_EXTENSIONS = environ.get("ALLOWED_EXTENSIONS", {'png', 'jpg', 'jpeg', 'svg'})


    PORT = environ.get("PORT")

            # database
    DB_PORT = environ.get("DB_PORT")
    DB_HOST = environ.get("DB_HOST")
    DB_NAME = environ.get("DB_NAME")
    DB_USERNAME = environ.get("DB_USERNAME")
    DB_PASSWORD = environ.get("DB_PASSWORD")
    
        # s3
    ACCESS_KEY_ID = environ.get("ACCESS_KEY_ID")
    SECRET_ACCESS_KEY = environ.get("SECRET_ACCESS_KEY")
    BUCKET = environ.get("BUCKET")
    S3_LOCATION = f"http://{BUCKET}.s3.amazonaws.com/"
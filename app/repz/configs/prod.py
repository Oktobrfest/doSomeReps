from .config import Config
import logging
import sys

from os import environ, path
from dotenv import load_dotenv


BASE_DIR = path.abspath(path.join(path.dirname(__file__), '..', '..'))

class ProdConfig(Config):
    
    load_dotenv(path.join(BASE_DIR, "prod.env"), override=True)
    
    SECRET_KEY = environ.get("SECRET_KEY")
    
    # routing
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
        
     # Debug Related
    FLASK_ENV = environ.get("FLASK_ENV", "production")
    TEMPLATES_AUTO_RELOAD = environ.get("TEMPLATES_AUTO_RELOAD", False)
    COMPRESSOR_DEBUG = environ.get("COMPRESSOR_DEBUG", False)    
    CACHE_TYPE = environ.get("CACHE_TYPE", "null")
    FLASK_DEBUG = environ.get("FLASK_DEBUG", "0")
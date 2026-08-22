"""Class-based Flask app configuration."""
import os
from os import environ, path
import logging
import sys

from dotenv import load_dotenv
import redis

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


class Config:
    """Configuration from environment variables."""

    load_dotenv(path.join(BASE_DIR, ".env"))

    CONFIGDIR = path.abspath(path.dirname(__file__))
    
    # Should be tested & Perhaps a default set!
    IDE = environ.get("IDE")    
    SESSION_LIFETIME = environ.get("SESSION_LIFETIME")
      
    # directory structure
    APP_DIR = environ.get('APP_DIR', 'repz')
    # Static Assets
    STATIC_FOLDER = environ.get("STATIC_FOLDER", "static")
    TEMPLATES_FOLDER = environ.get('TEMPLATES_FOLDER', 'templates')
   
    # file uploads
    UPLOADS_DEFAULT_DEST = environ.get("UPLOADS_DEFAULT_DEST", f'{APP_DIR}/{STATIC_FOLDER}') 
    UPLOAD_FOLDER = environ.get("UPLOAD_FOLDER", UPLOADS_DEFAULT_DEST) 
    UPLOADED_IMAGES_DEST = environ.get("UPLOADED_IMAGES_DEST", UPLOADS_DEFAULT_DEST) 
    ALLOWED_EXTENSIONS = environ.get("ALLOWED_EXTENSIONS", {'png', 'jpg', 'jpeg', 'svg'})

    # Redis Cache 
    CACHE_TYPE = "RedisCache"
    CACHE_DEFAULT_TIMEOUT = 300
    CACHE_REDIS_HOST = environ.get('CACHE_REDIS_HOST', 'localhost')
    CACHE_REDIS_PORT = int(environ.get('CACHE_REDIS_PORT', 6379))
    CACHE_REDIS_DB = int(environ.get('CACHE_REDIS_DB', 0))

    # SESSION
    SESSION_TYPE = "redis"
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True
    # Use the same Redis params you set for Cache
    SESSION_REDIS = redis.from_url(f"redis://{CACHE_REDIS_HOST}:{CACHE_REDIS_PORT}/{CACHE_REDIS_DB}")

    @staticmethod
    def setup_image_paths(path):
        """Define the output directory for images & set permissions."""
        if not os.path.exists(path):
            os.makedirs(path)
            os.chmod(path, 0o775)

    @classmethod
    def initialize_image_paths(cls):
        image_paths = set(filter(None, [
            cls.UPLOADED_IMAGES_DEST, 
            cls.UPLOAD_FOLDER
        ]))        
        return image_paths
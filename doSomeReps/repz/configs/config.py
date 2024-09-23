"""Class-based Flask app configuration."""
import os
from os import environ, path
import logging
import sys

from dotenv import load_dotenv


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


class Config:
    """Configuration from environment variables."""

    load_dotenv(path.join(BASE_DIR, ".env"))

    CONFIGDIR = path.abspath(path.dirname(__file__))
    
    IDE = environ.get("IDE")    
    SESSION_LIFETIME = environ.get("SESSION_LIFETIME")

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
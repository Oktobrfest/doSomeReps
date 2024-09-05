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

from .config import Config
import logging
import sys
from dotenv import load_dotenv

from os import environ, path


class DevConfig(Config):
    """Development Configuration from dev.env environment variables."""
    
    BASE_DIR = path.abspath(path.join(path.dirname(__file__), '..', '..'))
    
    load_dotenv(path.join(BASE_DIR, "dev.env"), override=True)
     
    SECRET_KEY = environ.get("SECRET_KEY")

    # routing
    PORT = environ.get("PORT")

    # SHOULD ALREADY BE SET VIA Parent config. Test & delete this.
    # IDE = environ.get("IDE")    
        
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
    REGION_NAME = environ.get("REGION_NAME")
    
    # Debug Related
    FLASK_ENV = environ.get("FLASK_ENV", "development")
    TEMPLATES_AUTO_RELOAD = environ.get("TEMPLATES_AUTO_RELOAD", True)
    COMPRESSOR_DEBUG = environ.get("COMPRESSOR_DEBUG", True)
    CACHE_TYPE = environ.get("CACHE_TYPE", "null")
    FLASK_DEBUG = environ.get("FLASK_DEBUG", "1")
    
    #included to be able to step into other modules
    # set in docker-compose or .env DEBUG = True
    # Part of Flasks Debug toolbar.
    DEBUG_TB_INTERCEPT_REDIRECTS = False 
    
    if Config.IDE == "pycharm":
        from . import pycharm  
    
    
    logging.basicConfig(level=logging.DEBUG,
                        format=f'%(asctime)s %(levelname)s %(name)s %(threadName)s : %(message)s')

    
    # DATABASE RELATED: (EXTREMELY VERBOSE)
    # logging.getLogger('sqlalchemy.engine').setLevel(logging.DEBUG)
    # logging.getLogger('sqlalchemy.pool').setLevel(logging.DEBUG)
    logging.getLogger('sqlalchemy.orm').setLevel(logging.DEBUG)

    # Redirect SQLAlchemy logs to stdout
    # logging.getLogger('sqlalchemy.engine').addHandler(
        # logging.StreamHandler(sys.stdout))

    # logging.getLogger('sqlalchemy.pool').addHandler(
        # logging.StreamHandler(sys.stdout))
    logging.getLogger('sqlalchemy.orm').addHandler(
        logging.StreamHandler(sys.stdout))
    

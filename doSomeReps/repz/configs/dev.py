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
    FLASK_ENV = environ.get("FLASK_ENV", "development")
    
    # THIS NEEDS DOUBLE CHECKING!!
    APP_DIR = environ.get('APP_DIR', 'repz')
    
    # Static Assets
    HOME_STATIC_FOLDER = environ.get("HOME_STATIC_FOLDER", "static")
    STATIC_FOLDER = environ.get("STATIC_FOLDER", "static")
    TEMPLATES_FOLDER = environ.get('TEMPLATES_FOLDER', 'templates')
    COMPRESSOR_DEBUG = environ.get("COMPRESSOR_DEBUG", False)
    # file uploads
    UPLOADS_DEFAULT_DEST = environ.get("UPLOADS_DEFAULT_DEST", f'{APP_DIR}/{STATIC_FOLDER}') 
    UPLOAD_FOLDER = environ.get("UPLOAD_FOLDER", UPLOADS_DEFAULT_DEST) 
    UPLOADED_IMAGES_DEST = environ.get("UPLOADED_IMAGES_DEST", UPLOADS_DEFAULT_DEST) 
    ALLOWED_EXTENSIONS = environ.get("ALLOWED_EXTENSIONS", {'png', 'jpg', 'jpeg', 'svg'})


    #included to be able to step into other modules
    # set in docker-compose or .env DEBUG = True
    DEBUG_TB_INTERCEPT_REDIRECTS = False

    PORT = environ.get("PORT")
    # logging.basicConfig()
    logging.basicConfig(level=logging.DEBUG,
                        format=f'%(asctime)s %(levelname)s %(name)s %(threadName)s : %(message)s')

    
    # DATABASE RELATED: (EXTREMELY VERBOSE)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.DEBUG)
    logging.getLogger('sqlalchemy.pool').setLevel(logging.DEBUG)
    logging.getLogger('sqlalchemy.orm').setLevel(logging.DEBUG)

    # Redirect SQLAlchemy logs to stdout
    logging.getLogger('sqlalchemy.engine').addHandler(
        logging.StreamHandler(sys.stdout))

    logging.getLogger('sqlalchemy.pool').addHandler(
        logging.StreamHandler(sys.stdout))
    logging.getLogger('sqlalchemy.orm').addHandler(
        logging.StreamHandler(sys.stdout))

    CACHE_TYPE = environ.get("PORT", "null")
    IDE = environ.get("IDE")    
    
    TEMPLATES_AUTO_RELOAD = True

    if IDE == "pycharm":
        from . import pycharm
        
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
    
    
    # included to be able to step into other modules
    # Part of Flasks Debug toolba. maybe irrellivent
    # set in docker-compose or .env DEBUG = True
    # DEBUG_TB_INTERCEPT_REDIRECTS = False
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from urllib.parse import quote

from config import Config

from flask import current_app as app

DB_HOST = Config.DB_HOST
DB_PORT = Config.DB_PORT
SERVER = f'{DB_HOST}:{DB_PORT}'

DATABASE = Config.DB_NAME  
USERNAME = Config.DB_USERNAME
PASSWORD = quote(Config.DB_PASSWORD)
DRIVER = 'psycopg2'

SQLALCHEMY_DATABASE_URL = f'postgresql+{DRIVER}://{USERNAME}:{PASSWORD}@{SERVER}/{DATABASE}'

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, echo=False, future=True, pool_recycle=1800, pool_pre_ping=True)

session = scoped_session(sessionmaker(autocommit=False,
                                         autoflush=False,
                                         bind=engine,
                                         future=True))


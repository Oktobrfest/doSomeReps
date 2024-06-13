from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote

from setuptools import setup, find_packages

from config import Config

DB_HOST = Config.DB_HOST
DB_PORT = Config.DB_PORT
SERVER = f'{DB_HOST}:{DB_PORT}'

DATABASE = Config.DB_NAME  
USERNAME = Config.DB_USERNAME
PASSWORD = quote(Config.DB_PASSWORD)
DRIVER = 'psycopg2'

SQLALCHEMY_DATABASE_URL = f'postgresql+{DRIVER}://{USERNAME}:{PASSWORD}@{SERVER}/{DATABASE}'

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, echo=False, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush = False, bind=engine)

Base = declarative_base()
# other guys recomendeation on stack ov

Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
Session.configure(bind=engine)
session = Session(future=True)


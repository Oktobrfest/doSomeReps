from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote

from setuptools import setup, find_packages

from config import Config

server = Config.DB_ADDRESS
database = Config.DB_NAME  
username = Config.DB_USERNAME
password = quote(Config.DB_PASSWORD)
driver = 'psycopg2'

# driver = 'ODBC Driver 18 for SQL Server'
# SQLALCHEMY_DATABASE_URL = f'mssql://{username}:{password}@{server}/{database}?driver={driver}&encrypt=no'
# SQLALCHEMY_DATABASE_URL = f'postgresql+psycopg2://scott:tiger@host/dbname

SQLALCHEMY_DATABASE_URL = f'postgresql+{driver}://{username}:{password}@{server}/{database}'

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, echo=False, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush = False, bind=engine)

Base = declarative_base()
# other guys recomendeation on stack ov

Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
Session.configure(bind=engine)
session = Session(future=True)


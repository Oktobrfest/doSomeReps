from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from setuptools import setup, find_packages

from config import Config

server = Config.DB_ADDRESS
database = Config.DB_NAME  
username = Config.DB_USERNAME
password = Config.DB_PASSWORD

# driver = 'ODBC Driver 18 for SQL Server'
# SQLALCHEMY_DATABASE_URL = f'mssql://{username}:{password}@{server}/{database}?driver={driver}&encrypt=no'

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, echo=False, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush = False, bind=engine)

Base = declarative_base()
# other guys recomendeation on stack ov

Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
Session.configure(bind=engine)
session = Session(future=True)


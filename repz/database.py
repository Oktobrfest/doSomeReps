from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from setuptools import setup, find_packages



Server = 'LAPTOP-ASUS-LAP\SQLEXPRESS'
Database = 'reps'
Driver = 'ODBC Driver 17 for SQL Server'

SQLALCHEMY_DATABASE_URL = f'mssql://@{Server}/{Database}?driver={Driver}'

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, echo=True, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush = False, bind=engine)

Base = declarative_base()
# other guys recomendeation on stack ov
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
Session.configure(bind=engine)
session = Session(future=True)


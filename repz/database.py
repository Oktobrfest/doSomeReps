from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from setuptools import setup, find_packages

import pyodbc 
# Some other example server values are
# server = 'localhost\sqlexpress' # for a named instance
# server = 'myserver,port' # to specify an alternate port
# server = 'tcp:myserver.database.windows.net' 
# database = 'mydb' 
# username = 'myusername' 
# password = 'mypassword' 
# # ENCRYPT defaults to yes starting in ODBC Driver 18. It's good to always specify ENCRYPT=yes on the client side to avoid MITM attacks.
# cnxn = pyodbc.connect('DRIVER={ODBC Driver 18 for SQL Server};SERVER='+server+';DATABASE='+database+';ENCRYPT=yes;UID='+username+';PWD='+ password)
# cursor = cnxn.cursor()
username = 'admin' 
password = 'Rocking9!'
 
Server = 'repdb.cakbh4mjxv9u.us-west-2.rds.amazonaws.com,1433'
Database = 'repdb'
Driver = 'ODBC Driver 18 for SQL Server'

SQLALCHEMY_DATABASE_URL = f'mssql://{username}:{password}@{Server}/{Database}?driver={Driver}'


# SQLALCHEMY_DATABASE_URL = f'mssql://@{Server}/{Database}?driver={Driver}'

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, echo=True, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush = False, bind=engine)

Base = declarative_base()
# other guys recomendeation on stack ov
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
Session.configure(bind=engine)
session = Session(future=True)


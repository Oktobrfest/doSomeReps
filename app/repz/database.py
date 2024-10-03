from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from urllib.parse import quote

from flask import current_app

DB_HOST = current_app.config['DB_HOST']
DB_PORT = current_app.config['DB_PORT']
SERVER = f'{DB_HOST}:{DB_PORT}'

DATABASE = current_app.config['DB_NAME']
USERNAME = current_app.config['DB_USERNAME']
PASSWORD = quote(current_app.config['DB_PASSWORD'])
DRIVER = current_app.config.get('DRIVER', 'psycopg2')

SQLALCHEMY_DATABASE_URL = f'postgresql+{DRIVER}://{USERNAME}:{PASSWORD}@{SERVER}/{DATABASE}'

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, echo=False, future=True, pool_recycle=1800, pool_pre_ping=True)

session = scoped_session(sessionmaker(autocommit=False,
                                         autoflush=False,
                                         bind=engine,
                                         future=True))


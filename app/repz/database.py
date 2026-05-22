from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from urllib.parse import quote
from sqlalchemy.engine import URL

from flask import current_app

# def get_db_url():
#     DB_HOST = current_app.config['DB_HOST']
#     DB_PORT = current_app.config['DB_PORT']
#     SERVER = f'{DB_HOST}:{DB_PORT}'

#     DATABASE = current_app.config['DB_NAME']
#     USERNAME = current_app.config['DB_USERNAME']
#     PASSWORD = quote(current_app.config['DB_PASSWORD'])
#     DRIVER = current_app.config.get('DRIVER', 'psycopg2')

#     return f'postgresql+{DRIVER}://{USERNAME}:{PASSWORD}@{SERVER}/{DATABASE}'


def get_db_url() -> str:
    driver = current_app.config.get("DRIVER", "").strip() or "psycopg2"
    drivername = driver if driver.startswith("postgresql") else f"postgresql+{driver}"

    url = URL.create(
        drivername=drivername,
        username=current_app.config["DB_USERNAME"],
        password=current_app.config["DB_PASSWORD"],
        host=current_app.config["DB_HOST"],
        port=int(current_app.config.get("DB_PORT", "5432")),
        database=current_app.config["DB_NAME"],
    )

    return url.render_as_string(hide_password=False)


class SessionProxy:
    def __init__(self):
        self._session = None

    @property
    def session(self):
        if self._session is None:
            engine = create_engine(
                get_db_url(), echo=False, future=True, pool_recycle=1800, pool_pre_ping=True)

            self._session = scoped_session(sessionmaker(autocommit=False,
                                                     autoflush=False,
                                                     bind=engine,
                                                     future=True))
        return self._session

    def __getattr__(self, name):
        if name.startswith("__") and name.endswith("__"):
            raise AttributeError(name)
        if name == "_is_coroutine_marker":
            raise AttributeError(name)
        return getattr(self.session, name)

proxy = SessionProxy()
session = proxy

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy.engine import URL

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Make the project's `repz` package importable. Depending on where
# this env.py runs from, the package may live in `<parent>/app/repz`
# (running on the host from the project root) or `<parent>/repz`
# (inside the dev container, where ./app is mounted at /app and this
# file ends up at /app/migrations/env.py).
_HERE = os.path.dirname(os.path.abspath(__file__))
_PARENT = os.path.abspath(os.path.join(_HERE, os.pardir))
for _candidate in (os.path.join(_PARENT, "app"), _PARENT):
    if os.path.isdir(os.path.join(_candidate, "repz")):
        sys.path.insert(0, _candidate)
        break

# Import the project's declarative Base so Alembic can autogenerate
# migrations by diffing the models against the live DB.
from repz.models import Base  # noqa: E402

target_metadata = Base.metadata

# Build the DB URL from environment variables passed into the container by
# docker compose. docker compose reads the repository .env file for these
# substitutions, then exposes them to this Alembic process.
def _get_url() -> str:
    driver = os.environ.get("DRIVER", "").strip() or "psycopg2"
    drivername = driver if driver.startswith("postgresql") else f"postgresql+{driver}"

    return str(
        URL.create(
            drivername=drivername,
            username=os.environ["DB_USERNAME"],
            password=os.environ["DB_PASSWORD"],
            host=os.environ["DB_HOST"],
            port=int(os.environ.get("DB_PORT", "5432")),
            database=os.environ["DB_NAME"],
        )
    )


config.set_main_option("sqlalchemy.url", _get_url())


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

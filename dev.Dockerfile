FROM python:3.12-alpine AS base-packages-stage1

WORKDIR /app

RUN apk --no-cache add \
    g++ \
    unixodbc-dev \
    gnupg \
    nodejs \
    npm \
    build-base \
    postgresql-dev \
    git

FROM base-packages-stage1 AS pip-stage2

# Address distutils error
RUN pip install setuptools

COPY requirements.txt requirements.txt

# Add piwheels only for ARM architecture (e.g., Raspberry Pi)
RUN if [ "$(uname -m)" = "aarch64" ]; then \
    pip install --extra-index-url https://www.piwheels.org/simple -r requirements.txt; \
    else pip install -r requirements.txt; \
    fi

FROM pip-stage2 AS node-stage3

RUN pwd

COPY app/package*.json /app/

RUN npm install
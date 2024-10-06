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

# Add piwheels only for ARM architecture (e.g., Raspberry Pi)
RUN if [ "$(uname -m)" = "aarch64" ]; then \
    pip install --extra-index-url https://www.piwheels.org/simple; \
    fi

COPY requirements.txt requirements.txt

RUN pip install -r requirements.txt

FROM pip-stage2 AS node-stage3

RUN pwd

COPY app/package*.json /app/

# Sets default and retrieves vars
ARG NODE_ENV=production

RUN if [ "$NODE_ENV" = "production" ]; then npm install --only=production; else npm install; fi

FROM node-stage3 AS prod-stage4

COPY app /app
FROM python:3.9-alpine AS base-packages-stage1

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

COPY requirements.txt requirements.txt

RUN pip install -r requirements.txt

FROM pip-stage2 AS node-stage3

RUN pwd
RUN ls -la /app

#COPY package*.json ./
COPY app/package*.json /app/

RUN npm install
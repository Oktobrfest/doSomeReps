FROM python:3.9-alpine AS stage1

WORKDIR /app

# Install system dependencies for pyodbc and PDF.js
RUN apk --no-cache add \
    g++ \
    unixodbc-dev \
    gnupg \
    nodejs \
    npm \
    # Add build dependencies for psycopg2-binary or other packages requiring compilation
    build-base \
    postgresql-dev

COPY requirements.txt requirements.txt

RUN pip install -r requirements.txt

FROM stage1 AS stage2

COPY package*.json ./

RUN npm install

CMD ["python", "wsgi.py"]

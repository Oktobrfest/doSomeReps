FROM python:3.9-buster

WORKDIR /app

# Install system dependencies for pyodbc and PDF.js
RUN apt-get update && apt-get install -y \
    g++ \
    unixodbc-dev \
    gnupg \
    nodejs \
    npm

COPY requirements.txt requirements.txt
COPY package*.json ./

RUN pip install -r requirements.txt
RUN npm install

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
# Set the entrypoint script to run on container start
ENTRYPOINT ["entrypoint.sh"]

CMD ["python", "wsgi.py"]

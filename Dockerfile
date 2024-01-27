FROM python:3.9-buster

WORKDIR /app

# Install system dependencies for pyodbc
RUN apt-get update && apt-get install -y \
    g++ \
    unixodbc-dev \
    gnupg

# Add the Microsoft repository key and repository
# RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
#     && curl https://packages.microsoft.com/config/debian/10/prod.list > /etc/apt/sources.list.d/mssql-release.list

# # Install the MS SQL ODBC Driver
# RUN apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql18

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

RUN pip install debugpy

# COPY . .

CMD ["python", "wsgi.py"]






backup 
version: '3.8'
services:
  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      SA_PASSWORD: ${SQL_SERVER_SA_PASSWORD}
      ACCEPT_EULA: "Y"
    ports:
      - "1433:1433"
    volumes:
      - mssql_data:/var/opt/mssql

  reps:
    build:
      context: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=development
    volumes:
      - reps-project-volume:/var/www/reps-project
    command: tail -f /dev/null 
    # command: flask run --host=0.0.0.0
  
  proxy-mgr:
    image: 'jc21/nginx-proxy-manager:latest'
    restart: unless-stopped
    ports:
      # These ports are in format <host-port>:<container-port>
      - '80:80' # Public HTTP Port
      - '443:443' # Public HTTPS Port
      - '81:81' # Admin Web Port
      # Add any other Stream port you want to expose
      # - '21:21' # FTP
    environment:
      # Mysql/Maria connection parameters:
      DB_MYSQL_HOST: ${PROXY_DB_HOST}
      DB_MYSQL_PORT: 3306
      DB_MYSQL_USER: "npm"
      DB_MYSQL_PASSWORD: "npm"
      DB_MYSQL_NAME: "npm"
      # Uncomment this if IPv6 is not enabled on your host
      # DISABLE_IPV6: 'true'
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    depends_on:
      - db

  proxy-db:
    image: 'jc21/mariadb-aria:latest'
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: 'npm'
      MYSQL_DATABASE: 'npm'
      MYSQL_USER: 'npm'
      MYSQL_PASSWORD: 'npm'
    volumes:
      - ./mysql:/var/lib/mysql

volumes:
  mssql_data:
    name: "reps-db"
  reps-project-volume:
    name: "reps-project-volume"






All applicaiton/docker/nginx Info for chatGpt:

Reps:
/home/z/reps-project/Dockerfile:
Dockerfile:

FROM python:3.9-slim-buster

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "app.py"]

Docker-compose:
located: /home/z/reps-project/docker-compose.yaml
version: '3.8'
services:
  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      SA_PASSWORD: ${SQL_SERVER_SA_PASSWORD}
      ACCEPT_EULA: "Y"
    ports:
      - "1433:1433"
    volumes:
      - mssql_data:/var/opt/mssql

  reps:
    build:
      context: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=development
    volumes:
      - reps-project-volume:/var/www/reps-project
    command: tail -f /dev/null 
    # command: flask run --host=0.0.0.0
  
  npm:
    image: 'jc21/nginx-proxy-manager:latest'
    restart: unless-stopped
    ports:
      # These ports are in format <host-port>:<container-port>
      - '80:80' # Public HTTP Port
      - '443:443' # Public HTTPS Port
      - '82:81' # Admin Web Port
      # Add any other Stream port you want to expose
      # - '21:21' # FTP
    environment:
      # Mysql/Maria connection parameters:
      DB_MYSQL_HOST: "db"
      DB_MYSQL_PORT: 3306
      DB_MYSQL_USER: "npm"
      DB_MYSQL_PASSWORD: "npm"
      DB_MYSQL_NAME: "npm"
      # Uncomment this if IPv6 is not enabled on your host
      # DISABLE_IPV6: 'true'
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    depends_on:
      - db

  db:
    image: 'jc21/mariadb-aria:latest'
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: 'npm'
      MYSQL_DATABASE: 'npm'
      MYSQL_USER: 'npm'
      MYSQL_PASSWORD: 'npm'
    volumes:
      - ./mysql:/var/lib/mysql

volumes:
  mssql_data:
    name: "reps-db"
  reps-project-volume:
    name: "reps-project-volume"

---

within the docker volume:
/app/doSomeReps/wsgi.py
from repz import init_app 

app = init_app()
app.debug = True

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=12000, debug=True, use_reloader=False)

----

/app/doSomeReps/repz/__init__.py
"""Initialize Flask app."""
from flask import Flask, g
import os, sys
from .database import Base, engine, session
from flask_login import LoginManager, current_user
from config import Config
from flask import render_template, Blueprint, request, flash, redirect, url_for
from flask_caching import Cache


import os
import sys
from .models import users
import sqlalchemy as sa
from sqlalchemy import select, update
from sqlalchemy.sql import func
from flask_login import UserMixin
import flask_login
import flask
from werkzeug.utils import secure_filename

from os import environ

import boto3

from .flask_util_js import FlaskUtilJs

from sqlalchemy.orm import Query

from flask_uploads import configure_uploads, IMAGES, UploadSet
from . import ajax

#makes this globaly available
cache = Cache(config={'CACHE_TYPE': 'simple'})

def init_app():
    """Create Flask application."""
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object("config.Config")
    
    login_manager = LoginManager()
    login_manager.init_app(app)
    
    app.config['UPLOADS_DEFAULT_DEST'] = Config.UPLOADS_DEFAULT_DEST
    app.config['UPLOAD_FOLDER'] = Config.UPLOAD_FOLDER
    app.config['UPLOADED_IMAGES_DEST'] = Config.UPLOADED_IMAGES_DEST
        
    app.config['SECRET_KEY'] = Config.SECRET_KEY
      
    # lets you reference url_for in .js files
    fujs = FlaskUtilJs(app)    

    cache.init_app(app)

    with app.app_context():
        # Blueprint Shit
        # Import parts of our application
        from repz.home.home import home
        from repz.auth.auth import auth
        from repz.catz.catz import catz, catz_static
        from repz.ajax.quest_ajx.quest_ajx import quest_ajx
        from repz.ajax.user_ajx.user_ajx import user_ajx
        from repz.ajax.que_ajx.que_ajx import que_ajx

        # Register Blueprints
        app.register_blueprint(home)
        app.register_blueprint(auth)
        app.register_blueprint(catz)
        app.register_blueprint(catz_static, url_prefix='/catz')
        app.register_blueprint(quest_ajx)
        app.register_blueprint(user_ajx)
        app.register_blueprint(que_ajx)

        app.config['DEBUG'] = True
        app.config['DEBUG_TB_INTERCEPT_REDIRECTS'] = False
        
        ACCESS_KEY_ID = environ.get("ACCESS_KEY_ID")
        SECRET_ACCESS_KEY = environ.get("SECRET_ACCESS_KEY")
        bucket = environ.get("BUCKET")
      
        g.user = current_user
        
        login_manager = LoginManager(app)
        login_manager.login_view = "login"
                       
        @login_manager.user_loader
        def load_user(user_id):
            if user_id == 'None':
                current_user = flask_login.AnonymousUserMixin
                return current_user
            stmt = select(users).where(users.id == int(user_id))
            result = session.execute(stmt)
            for user_obj in result.scalars():
                #  Update last login value
                stmt = update(users).where(users.id == int(user_id)).values(last_login=func.now())
                result = session.execute(stmt)
                session.commit()
                return user_obj

        @login_manager.unauthorized_handler
        def unauthorized():
            """Redirect unauthorized users to Login page."""
            flash('You must be logged in to view that page.')
            # return render_template(url_for('homo.home1'))
            return flask.redirect(flask.url_for('auth.login', user=current_user))
            
    Base.metadata.create_all(engine)
       
    return app

    -----


Directory structure (Outside the volume before I mounted everything):

[+] Running 4/4
 ✔ Container reps-project-db-1     Started                                                            0.1s 
 ✔ Container reps-project-reps-1   Running                                                            0.0s 
 ✔ Container reps-project-mssql-1  Running                                                            0.0s 
 ✔ Container reps-project-npm-1    Started                                                            0.1s 
z@z:~/reps-project$ ls -al
total 48
drwxr-xr-x 6 z               z               4096 Dec  8 20:31 .
drwxr-x--- 9 z               z               4096 Dec  4 22:40 ..
-rw-r--r-- 1 z               z                369 Dec  8 20:29 .env
-rw-r--r-- 1 z               z                154 Dec  4 22:27 Dockerfile
drwxr-xr-x 7 root            root            4096 Dec  8 20:36 data
drwxr-xr-x 5 z               z               4096 Dec  3 08:39 doSomeReps
-rw-r--r-- 1 z               z               1637 Dec  8 20:35 docker-compose.yaml
drwxr-xr-x 3 root            root            4096 Dec  8 20:37 letsencrypt
drwxr-xr-x 6 systemd-network systemd-journal 4096 Dec  8 20:36 mysql
-rw-r--r-- 1 z               z                354 Dec  7 23:09 nginx.conf
-rw-r--r-- 1 z               z               1609 Dec  8 12:13 notes.md
-rw-r--r-- 1 z               z                654 Dec  2 20:46 requirements.txt
z@z:~/reps-project$ cd data
z@z:~/reps-project/data$ ls -al
total 32
drwxr-xr-x 7 root root 4096 Dec  8 20:36 .
drwxr-xr-x 6 z    z    4096 Dec  8 20:31 ..
drwxr-xr-x 2 root root 4096 Dec  8 20:36 access
drwxr-xr-x 2 root root 4096 Dec  8 20:36 custom_ssl
-rw-r--r-- 1 root root 2186 Dec  8 20:36 keys.json
drwxr-xr-x 2 root root 4096 Dec  8 20:36 letsencrypt-acme-challenge
drwxr-xr-x 2 root root 4096 Dec  8 20:36 logs
drwxr-xr-x 9 root root 4096 Dec  8 20:36 nginx
z@z:~/reps-project/data$ cd /home/z/reps-project/doSomeReps
z@z:~/reps-project/doSomeReps$ ls -al
total 52
drwxr-xr-x 5 z z 4096 Dec  3 08:39 .
drwxr-xr-x 6 z z 4096 Dec  8 20:31 ..
drwxr-xr-x 8 z z 4096 Dec  3 08:39 .git
-rwxr-xr-x 1 z z  631 Dec  3 08:39 .gitignore
drwxr-xr-x 2 z z 4096 Dec  3 08:39 .vscode
-rwxr-xr-x 1 z z  303 Dec  3 08:39 app.wsgi
-rwxr-xr-x 1 z z 1753 Dec  3 08:39 config.py
-rwxr-xr-x 1 z z  257 Dec  3 08:39 evnscript.py
-rw-r--r-- 1 z z  701 Dec  3 08:39 launch._BKUP.json
-rw-r--r-- 1 z z  698 Dec  3 08:39 launch.jsonBACKUP2
drwxr-xr-x 8 z z 4096 Dec  3 08:39 repz
-rw-r--r-- 1 z z  654 Dec  3 08:39 requirements.txt
-rwxr-xr-x 1 z z  546 Dec  3 08:39 wsgi.py
z@z:~/reps-project/doSomeReps$ 

---

In order for me to run the applicaiton in AWS I used these commands:
source /home/ubuntu/projects/venv/bin/activate

---
sudo  vim /etc/apache2/sites-enabled/000-default.conf:
<VirtualHost *:80>
      
        ServerAdmin webmaster@localhost
        ServerName  dosomereps.com
        ServerAlias www.dosomereps.com

        WSGIDaemonProcess repz user=ubuntu group=ubuntu threads=5 home=/home/ubuntu/projects  python-home=/home/ubuntu/projects/venv
        WSGIScriptAlias / /home/ubuntu/projects/app.wsgi

        <Directory /home/ubuntu/projects>
                WSGIProcessGroup repz
                WSGIApplicationGroup %{GLOBAL}
                Require all granted
                Allow from all
        </Directory>
        # Available loglevels: trace8, ..., trace1, debug, info, notice, warn,
        # error, crit, alert, emerg.
        # It is also possible to configure the loglevel for particular
        # modules, e.g.
        #LogLevel info ssl:warn

        ErrorLog ${APACHE_LOG_DIR}/error.log
        CustomLog ${APACHE_LOG_DIR}/access.log combined

RewriteEngine on
RewriteCond %{SERVER_NAME} =dosomereps.com [OR]
RewriteCond %{SERVER_NAME} =www.dosomereps.com
RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent]
</VirtualHost>

# vim: syntax=apache ts=4 sw=4 sts=4 sr noet
~                                                                   
~                                                                   
~                                                  




































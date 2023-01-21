"""Initialize Flask app."""
from flask import Flask, g
import os, sys
from .database import Base, engine, session
# dir_path = os.path.dirname(os.path.realpath(__file__))
# parent_dir_path = os.path.abspath(os.path.join(dir_path, os.pardir))
# sys.path.insert(0, parent_dir_path)
from flask_login import LoginManager, current_user
from config import Config
from flask import render_template, Blueprint, request, flash, redirect, url_for

import os
import sys
# sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
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
    

    with app.app_context():
        # Blueprint Shit
        # Import parts of our application
        from repz.routes import routes
        from repz.home.home import home
        from repz.auth.auth import auth
        # Register Blueprints
        app.register_blueprint(home)
        app.register_blueprint(routes)
        app.register_blueprint(auth)
        
        #Flask uploads
        #    s3 bucket tests
        ACCESS_KEY_ID = environ.get("ACCESS_KEY_ID")
        SECRET_ACCESS_KEY = environ.get("SECRET_ACCESS_KEY")
        bucket = environ.get("BUCKET")
        
        g.user = current_user
        
        @login_manager.user_loader
        def load_user(user_id):
            if user_id == 'None':
                current_user = flask_login.AnonymousUserMixin
                # print(vars(current_user))
                return current_user
            stmt = select(users).where(users.id == int(user_id))
            result = session.execute(stmt)
            for user_obj in result.scalars():
                #  Update last login value
                stmt = update(users).where(users.id == int(user_id)).values(last_login=func.now())
                result = session.execute(stmt)
                session.commit()
                return user_obj
                #  Didnt work: return sa.session.get(users, id)
                #NOT WORKED: return users.query.get(id) if id is not None else None

        @login_manager.unauthorized_handler
        def unauthorized():
            """Redirect unauthorized users to Login page."""
            flash('You must be logged in to view that page.')
            # return render_template(url_for('homo.home1'))
            return flask.redirect(flask.url_for('auth.login', user=current_user))
        

    
    Base.metadata.create_all(engine)
    
    
    
    
    return app
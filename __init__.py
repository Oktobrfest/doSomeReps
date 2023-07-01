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
        from repz.auth.auth import auth
        from repz.ajax.quest_ajx.quest_ajx import quest_ajx
        from repz.ajax.user_ajx.user_ajx import user_ajx
        from repz.ajax.que_ajx.que_ajx import que_ajx

        # Register Blueprints
        app.register_blueprint(home)
        app.register_blueprint(auth)
        app.register_blueprint(catz)
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
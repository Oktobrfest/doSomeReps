"""Initialize Flask app."""
import logging
import os
from datetime import timedelta
from os import environ

import flask
import flask_login
from flask import Flask, g, flash
from flask_caching import Cache
from flask_login import LoginManager, current_user
from sqlalchemy import select, update
from sqlalchemy.sql import func

from .flask_util_js import FlaskUtilJs
from .aws_s3 import S3


#makes this globaly available
cache = Cache(config={'CACHE_TYPE': 'simple'})

def init_app():
    """Create Flask application."""
    app = Flask(__name__, instance_relative_config=False)
        
    # login_manager = LoginManager()
    # login_manager.init_app(app)            
        
    # lets you reference url_for in .js files
    fujs = FlaskUtilJs(app)    

    cache.init_app(app)

    with app.app_context():
        
        env = os.getenv('FLASK_ENV', 'production')
        
        from .configs.config import Config
        
        # try:
        #     app.config.from_object(Config)
        # except Exception as e:
        #     print(f"Failed to load configuration: {e}")
        #     raise
        
        # Load the appropriate configuration
        if env == 'development':
            from .configs.dev import DevConfig as Conf
        else:  # Defaults to production
            from .configs.prod import ProdConfig as Conf
        
        try:
            app.config.from_object(Conf)
        except Exception as e:
            print(f"Failed to load Dev or Prod Configuration: {e}")
            raise
        
            # Initialize image paths
        image_paths = Conf.initialize_image_paths()
        for path in image_paths:
            Config.setup_image_paths(path)
                 
        from .database import session
        from .models import users
        
        # Blueprints
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
        
        g.user = current_user
        
        app.s3 = S3(app)
        
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
            
            return flask.redirect(flask.url_for('auth.login', user=current_user))
        
        @app.teardown_appcontext
        def shutdown_session(exception=None):
            if exception:
                session.rollback()
            session.remove()
                  
    return app
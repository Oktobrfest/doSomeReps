"""Initialize Flask app."""
import flask_login
import flask
from flask import Flask, g, flash
from .database import session
from flask_login import LoginManager, current_user
from config import Config
from flask_caching import Cache
from .models import users
from sqlalchemy import select, update
from sqlalchemy.sql import func
import timedelta
from os import environ
from .flask_util_js import FlaskUtilJs
import logging

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
    
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=Config.SESSION_LIFETIME)
    
    if Config.FLASK_ENV == 'development':
        logging.basicConfig(level=logging.DEBUG)
        app.config['TEMPLATES_AUTO_RELOAD'] = True
        
        if Config.IDE == "pycharm":
            import pycharm
            
        
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
    
       # redundant- delete this? app.config['DEBUG'] = True
        app.config['DEBUG_TB_INTERCEPT_REDIRECTS'] = False
        
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
            
            return flask.redirect(flask.url_for('auth.login', user=current_user))
        
        @app.teardown_appcontext
        def shutdown_session(exception=None):
            if exception:
                session.rollback()
            session.remove()
                  
    return app
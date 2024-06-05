"""Route declaration."""
from flask import current_app as app
from flask import render_template, Blueprint, request, flash, redirect, url_for
from .models import users
import sqlalchemy as sa
from . import *
from sqlalchemy import *
from .database import session
from sqlalchemy.sql import func
from flask_login import current_user, login_required, logout_user
from flask_login import *

routes = Blueprint('routes', __name__)
auth = Blueprint(
    'auth', __name__,
    template_folder='templates',
    static_folder='static'
)
home = Blueprint('home', __name__,
    template_folder='templates',
    static_folder='static'
)

@routes.route('/', methods=['GET', 'POST'], endpoint='home1')
@login_required
def home1():
    return render_template( 'home.html' )
    
### IS THIS PAGE EVEN USED???????
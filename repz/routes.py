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
    # if request.method == 'POST':
    #     username = request.form.get('username')
    #     # new_user = UserModel(id='SET IDENTITY_INSERT', first_name=first_name)
    #     new_user = UserModel(username=username, created_on=func.now() )
    #     print(new_user)
    #     session.add(new_user)
    #     session.commit()
    #     flash('Account created!', category='success')

    return render_template( 'home.html' )
    
    
    


# @views.route("/login", endpoint= 'login')
# def login():
#     return render_template( 'login.html' )
    
#         Blueprint Configuration
# home_bp = Blueprint(
#     'home_bp', __name__,
#     template_folder='templates',
#     static_folder='static'
# )


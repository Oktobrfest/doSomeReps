from flask import Blueprint, redirect, render_template, flash, request, session, url_for
from flask_login import login_required, logout_user, current_user, login_user
from flask import current_app as app
# from .. import login_manager
from ..models import users
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.sql import func
from sqlalchemy.orm import Query
from sqlalchemy import select

from ..database import *
from ..models import *
from repz.routes import *


# Blueprint Configuration
auth = Blueprint(
    'auth', __name__,
    template_folder='templates',
    static_folder='static'
)
routes = Blueprint('routes', __name__,
    template_folder='templates',
    static_folder='static'
    )

@auth.route('/login', methods=['GET', 'POST'], endpoint='login')
def login():
    # return render_template( 'login.html' )
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        # user = Base.users.query.filter_by(username=username).first() didnt work
        # works!!
        query = Query([users]).filter(users.username == username)
        current_user1 = query.with_session(session).first()
        if current_user1 == 'None': 
            flash("Invalid username bro!", category='error')
        elif current_user1 and current_user1.check_password(password=password):
            login_user(current_user1)
            #  next_page = request.args.get("next")
            flash('Logged in!', category='success')
            return redirect(url_for('home.homepage', user=current_user))
        flash("Invalid username/password combination", category='error')
    return render_template( 'login.html', user=current_user )

@auth.route("/logout")
def logout():
    logout_user()
    flash('Logged Out.', category='success')
    return redirect(url_for('auth.login'))

@auth.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'GET':
        return render_template( 'signup.html', user=current_user )

    if request.method == 'POST':
        
        username = request.form.get('username')
        password = request.form.get('password1')
        password2 = request.form.get('password2')
        email= request.form.get('email')
        # existing_user = users.query.filter_by(username=username).first()
        # existing_user = sa.session.query(users).query.all()
        # existing_user = Base.users.query.filter_by(username=username).first()
        # try this too
        # result1 = session.get(users.username, username) #not correct way to use it. need to use key
        existing_user = session.execute(select(users).where(users.username == username)).first()
        # Alternate way to do it is: session.query(func.count(users.id))
                
        # Validation
        if password != password2:
            flash('Passwords don\'t match.', category='error')
        elif len(password) < 4:
            flash('Password must be at least 4 characters.', category='error')
        elif len(email) < 4:
            flash('email must be at least 4 characters.', category='error')
        elif existing_user is None:
            new_user = users(
                    username=username,
                    created_on=func.now(),
                    email= email,
                    password=generate_password_hash(
                        password, method='sha256')
                    )
            login_user(new_user)
            session.add(new_user)
            session.commit()
            flash('Account created!', category='success')
            return render_template( url_for('auth.login', user=current_user ))
        else:
            flash('That username already exists. Please choose a different one.', category='error')
            # return render_template(url_for('auth.signup', user=current_user ))

    return render_template('signup.html', user=current_user )
    
    
    
    
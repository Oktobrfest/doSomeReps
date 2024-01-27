from flask import Blueprint, redirect, render_template, flash, request, session, url_for, jsonify
from flask_login import login_required, logout_user, current_user, login_user
from flask import current_app as app
from ...models import users
from ...bluehelpers import *
import json

from ...database import *
from ...models import *
from repz.routes import *
from ...bluehelpers import *


# Blueprint Configuration
user_ajx = Blueprint("user_ajx", __name__)



@user_ajx.route("/fav_user", methods=["POST"], endpoint="fav_user")
@login_required
def fav_user():
    UID = g._login_user.id
   # because you sent the data via text/plain, It needs decoding.
   # redundant!
    data = request.data.decode("utf-8")
    user_id = data

    fav_user = get_user(user_id)
    usr = get_user(UID)
    
    usr.favorates.append(fav_user)

    session.commit() 
        
    msg = "Question creator added to your favorites list"
    flash(msg, category="success")
    
    response_msg = jsonify('ok')
    
    return response_msg 


@user_ajx.route("/unfavorite_user", methods=["POST"], endpoint="unfavorite_user")
@login_required
def unfavorite_user():
    UID = g._login_user.id
   
    data = request.get_json()  # This will give you a Python dictionary
    user_id = data['user_id']

    unfav_user = get_user(user_id)
    usr = get_user(UID)
    
    usr.favorates.remove(unfav_user)

    session.commit() 
        
    msg = "Unfavorited User"
    flash(msg, category="success")
    
    response_msg = jsonify('ok')
    
    return response_msg      
                    
         
@user_ajx.route("/block_user", methods=["POST"], endpoint="block_user")
@login_required
def block_user():
    UID = g._login_user.id
    
    block_user_id = request.form.get("block_user_id")
    blocked_user = get_user(block_user_id)
    usr = get_user(UID)
    
    usr.blocked_users.append(blocked_user)

    if blocked_user in usr.favorates:
        usr.favorates.remove(blocked_user)
    
    session.commit() 
           
    msg = "Blocked User"
    flash(msg, category="success")
    return msg      


@user_ajx.route("/unblock_user", methods=["POST"], endpoint="unblock_user")
@login_required
def unblock_user():
    UID = g._login_user.id
    block_user_id = request.form.get("blk_user_id")
    blocked_user = get_user(block_user_id)
    usr = get_user(UID)
    
    usr.blocked_users.remove(blocked_user)

    session.commit() 
        
    msg = "Unblocked User"
    flash(msg, category="success")
    
    response_msg = jsonify('ok')
    
    return response_msg      


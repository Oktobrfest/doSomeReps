from flask import (
    Blueprint,
    render_template,
    request,
    jsonify,
    flash,
    Flask,
    flash,
    redirect,
    url_for,
    session as local_session,
)

from flask import jsonify, make_response, g, send_from_directory, current_app as app

from sqlalchemy.orm import (
    Query,
    selectinload,
    joinedload,
    aliased,
    subqueryload,
    with_parent,
    contains_eager,
)
from sqlalchemy.sql import func, exists, distinct
from sqlalchemy.sql.expression import bindparam, ColumnOperators
from sqlalchemy import (
    select,
    Interval,
    join,
    intersect,
    update,
    not_,
    except_,
    and_,
    or_,
    text,
    
)
from ..database import Base, engine, session
from ..models import category, question, q_pic, quizq, level, users, rating, excluded_questions

from ..bluehelpers import *
from flask_login import current_user, login_required


catz = Blueprint(
    'catz', __name__,
    template_folder='templates',
)

catz_static = Blueprint(
    'catz_static', __name__,
    static_folder='static'
)


@catz.route('/topiclist', methods=['GET', 'POST'], endpoint='topiclist')
def topiclist():
    topics_list = cat_questions_count(100)
    topics = dict(topics_list)
   
    # Render the template and pass the categories to it
    
    return render_template('topiclist.html', 
                           user=current_user,
                           topics=topics,
                           )

@catz_static.route('/static/<path:filename>')
def custom_static(filename):
    return send_from_directory(catz_static.static_folder, filename)




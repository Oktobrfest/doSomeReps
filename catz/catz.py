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

from flask import jsonify, make_response, g, current_app as app

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





catz = Blueprint("catz", __name__, template_folder="templates", static_folder="static")


@app.route('/categories/')
def categories():
    # Get all categories from the database
    categories = Category.query.all()
    # Render the template and pass the categories to it
    return render_template('categories.html', categories=categories)





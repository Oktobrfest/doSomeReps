import os

from flask import (
    Blueprint,
    current_app as app,
    flash,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session as local_session,
    url_for
)
from flask_login import current_user, login_required, logout_user
from flask_uploads import IMAGES, UploadSet, configure_uploads
from flask_wtf import FlaskForm
from sqlalchemy import (
    Interval,
    and_,
    except_,
    intersect,
    join,
    not_,
    or_,
    select,
    text,
    update
)
from sqlalchemy.orm import (
    aliased,
    contains_eager,
    joinedload,
    selectinload,
    subqueryload,
    with_parent
)
from sqlalchemy.sql import func, exists, distinct

from sqlalchemy.sql.expression import bindparam

from werkzeug.utils import secure_filename
from wtforms import FileField, IntegerField, StringField, SubmitField, validators  # Re-added validators
from wtforms.validators import DataRequired, NumberRange

from repz.extensions import cache
from repz.cache_helper import CacheHelper
from repz.routes import home
from repz.services.quiz_service import get_selected_categories

from ..bluehelpers import (
    cat_questions_count,
    get_all_categories,
    get_quizes,
    get_session,
    get_user,
    set_session,
    split_dict,
    tally_que_catz
)
from ..charts import rep_vs_forget, render_chart
from ..database import session
from ..models import (
    category,
    excluded_questions,
    level,
    q_pic,
    question,
    quizq,
    rating,
    users
)
# Imported for its side effect: configuring the image UploadSet.
from . import homeforms  # noqa: F401


@home.route("/favicon.ico")
def favicon():
    return send_from_directory(
        os.path.join(app.root_path, "static"),
        "favicon.ico",
        mimetype="image/vnd.microsoft.icon",
    )


@home.route("/about", methods=["GET", "POST"], endpoint="about")
@cache.cached(timeout=500000)
def about():
    """About us page."""
    day_qry = select(level.level_no,level.days_hence)
    days_obj_all = session.execute(day_qry).all()

    intervals = [
        {"levelNo": d.level_no, "daysHence": d.days_hence} for d in days_obj_all
    ]

    return render_template(
        "about.html",
        user=current_user,
        intervals=intervals,
        title="About",
        description="About us page.",
    )


@home.route("/", methods=["GET", "POST"], endpoint="homepage")
def homepage():
    """Homepage."""
    if current_user.is_authenticated:
        # Render a homepage for authenticated users
        UID = g._login_user.id

        user_qry = select(users).where(users.id == UID)

        user = session.execute(user_qry).scalars().first()

        # Lists of objects, not id->name maps: the React home page needs a
        # stable key and a display name per row.
        favorites = [{"id": u.id, "username": u.username} for u in user.favorates]
        blocked = [{"id": b.id, "username": b.username} for b in user.blocked_users]


        selected_cats = get_all_categories()

        que_list = get_quizes(selected_cats, UID)

        category_count = tally_que_catz(que_list)

        sorted_cats = sorted(category_count.items(), key = lambda x: x[1], reverse = True)
        limited_sorted_cats = sorted_cats[:5]
        sorted_cats_dict = dict(limited_sorted_cats)

        x_arr, y_arr = split_dict(sorted_cats_dict)

        catz_chart = render_chart(x_arr, y_arr, 'Categories', 'Questions')

        return render_template(
            "home.html",
            title="Homepage",
            description=".",
            favorites=favorites,
            blocked=blocked,
            user=current_user,
            quiz_q_count=len(que_list),
            catz_chart=catz_chart,
            )
    else:
        # categories graph
        sorted_ques_cat_count = cat_questions_count(8)
        limited_cat_count = dict(sorted_ques_cat_count)
        categories, question_count = split_dict(limited_cat_count)

        categories_graph = render_chart(categories, question_count, 'Categories', 'Questions')

        repetition_days_real = list(session.execute(select(level.days_hence)).scalars().all())

        forgetting_chart = rep_vs_forget(repetition_days_real)

        # Render a different homepage for unauthenticated users
        return render_template('landing.html',
                               user=current_user,
                               forgetting_chart = forgetting_chart,
                               categories_graph = categories_graph)


# creates a new question
@home.route("/addcontent", methods=["GET"], endpoint="addcontent")
@login_required
def addcontent():
    """Shell for the add-content SPA.

    The page is a React island: it picks its categories from /api/categories and
    posts the finished question to quest_ajx.addq, the one route that writes a
    new question, so nothing about the form lives here.
    """
    return render_template(
        "addcontent.html",
        title="Add content",
        description=".",
        user=current_user,
    )


@home.route("/quiz", methods=["GET"], endpoint="quiz")
@login_required
def quiz():
    """
    Shell for the quiz SPA.

    The page fetches its own question queue from /quiz/queue, so nothing here
    depends on whether the reader has audio switched on.
    """
    return render_template(
        "quiz.html",
        title="Quiz",
        description=".",
        user=current_user,
        category_list=get_all_categories(),
        selected_categories=get_selected_categories(),
    )


@home.route("/quemore", methods=["GET", "POST"], endpoint="quemore")
@login_required
def quemore():
    category_list = get_all_categories()
    search_que_filters = get_session("search_que_filters")
    if search_que_filters == 'Not set':
        selected_categories = []
    else:
        selected_categories = search_que_filters['catz']

    return render_template(
        "quemore.html",
        title="Que More Questions",
        description="Que More Questions",
        user=current_user,
        category_list=category_list,
        selected_categories=selected_categories,
    )


@home.route("/editquestions", methods=["GET"], endpoint="editquestions")
@login_required
def editquestions():
    
    return render_template(
        "editquestions.html",
        title="Edit or Delete Questions",
        user=current_user,
    )


@home.route("/edit_question", methods=["GET"], endpoint="edit_question")
@login_required
def edit_question():
    return render_template(
        "edit_question.html",
        user=current_user,
    )


@home.route("/api/flag", methods=["POST"], endpoint="flag_question")
@login_required
def flag_question():
    from repz.database import session
    from repz.models import flag, FlagCategory

    data = request.get_json(silent=True) or {}
    raw_question_id = data.get("questionId")
    category_name = data.get("category")
    note = data.get("note")

    try:
        question_id = int(raw_question_id)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "error": "questionId is required and must be an integer.",
        }), 400

    try:
        existing_flag = session.query(flag).filter_by(user_id=current_user.id, question_id=question_id).first()

        if not category_name:
            if existing_flag:
                session.delete(existing_flag)
                session.commit()
            return jsonify({
                "success": True,
                "action": "delete",
            })

        try:
            flag_cat = FlagCategory(category_name)
        except ValueError:
            return jsonify({
                "success": False,
                "error": f"Invalid flag category: {category_name}",
            }), 400

        if existing_flag:
            existing_flag.flag_category = flag_cat
            existing_flag.note = note
            action = "update"
        else:
            new_flag = flag(
                user_id=current_user.id,
                question_id=question_id,
                flag_category=flag_cat,
                note=note
            )
            session.add(new_flag)
            action = "create"

        session.commit()
        return jsonify({
            "success": True,
            "action": action,
            "flag": {
                "category": flag_cat.value,
                "note": note
            }
        })

    except Exception as e:
        session.rollback()
        return jsonify({
            "success": False,
            "error": f"Failed to save flag: {str(e)}"
        }), 500

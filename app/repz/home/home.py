import copy
import hashlib
import json
import logging
import math
import os
import random
import re

from re import A
from typing import final

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
    Query,
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
from repz.services.quiz_service import QuizPageConfig, render_quiz_page

from ..bluehelpers import (
    cat_questions_count,
    clean_for_html,
    get_all_categories,
    get_quizes,
    get_session,
    get_user,
    create_brand_new_quizq,
    remove_underscore,
    set_session,
    split_dict,
    tally_que_catz,
    get_categories_questions
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
from .form_helpers import save_pictures
from .homeforms import QueAdditionForm, QuestionForm


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

    days = [ (d.level_no, d.days_hence) for d in days_obj_all ]

    return render_template(
        "about.html",
        user=current_user,
        days=days,
        title="About",
        description="About us page.",
        #catz_chart=catz_chart,
    )


@home.route("/", methods=["GET", "POST"], endpoint="homepage")
def homepage():
    """Homepage."""
    if current_user.is_authenticated:
        # Render a homepage for authenticated users
        UID = g._login_user.id

        user_qry = select(users).where(users.id == UID)

        user = session.execute(user_qry).scalars().first()

        favorites = {}
        blocked = {}
        for u in user.favorates:
            favorites[u.id] = u.username

        for b in user.blocked_users:
            blocked[b.id] = b.username


        selected_cats = get_all_categories()

        que_list = get_quizes(selected_cats, UID)

        category_count = {}
        for q in que_list:
            for c in q['categories']:
                if c in category_count:
                    category_count[c] += 1
                else:
                    category_count[c] = 1

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
@home.route("/addcontent", methods=["GET", "POST"], endpoint="addcontent")
@login_required
def addcontent():
    UID = g._login_user.id
    form = QuestionForm()
    category_list = get_all_categories()
    # cleaned_cat_list = list(map(lambda x: clean_for_html(x), category_list))
    if request.method == "GET":
        return render_template(
            "addcontent.html",
            title="Add content",
            description=".",
            user=current_user,
            category_list=category_list,
            form=form,
        )

    question_text = request.form.get("question_text")
    hint = request.form.get("hint")
    answer = request.form.get("answer")
    privacy_chkbox = request.form.get("privacy-checkbox")
    if privacy_chkbox == "on":
        privacy = True
    else:
        privacy = False

    selected_categories = request.form.getlist("category_name")

    #remove the html versions underscores
    spaced_cats = list(map(lambda x: remove_underscore(x), selected_categories))

    #  TEESTING MULTIPLE IMAGE UPLOADS
    if form.validate_on_submit():
        fail = False
        if len(question_text) < 3 or len(answer) < 1:
            flash("Question text is too short!", category="error")
            fail = True
        existing_q_text = session.execute(
            select(question).where(question.question_text == question_text)
        ).first()
        if existing_q_text is not None:
            flash("question already exists!", category="error")
            fail = True
        if len(selected_categories) < 1:
            fail = True
            flash("You must select at least one category!", category="error")
        # if fail == True:
        #     return redirect(url_for("home.addcontent"))

        if len(answer) > 3999:
            # THROW/LOG error here because client isn't validating form lenght properly!
            answer = answer[:3999]

        if fail:
            flash("Failed Validation!", category="error")
            return render_template(
                "addcontent.html",
                title="Add content",
                description=".",
                user=current_user,
                category_list=category_list,
                selected_categories=selected_categories,
                form=form, # possibly replace this with QuestionForm()
            )

        # create new question!
        new_question = question(
            question_text=question_text,
            hint=hint,
            created_on=func.now(),
            answer=answer,
            created_by=UID,
            privacy=privacy
        )
        # append categories so it dont glitch
        for cat_name in spaced_cats:
            query = Query([category]).filter(category.category_name == cat_name)
            cat = query.with_session(session).first()
            new_question.categories.append(cat)

        # pictures
        save_pictures(new_question, request)

        session.add(new_question)
        session.commit()

        auto_que = request.form.get("automatically-que-created-question")

        if auto_que == "on":
            question_ids = [new_question.question_id]
            create_brand_new_quizq(question_ids, current_user.id)

        flash("New question created!", category="success")


    return render_template(
        "addcontent.html",
        title="Add content",
        description=".",
        user=current_user,
        category_list=category_list,
        selected_categories=selected_categories,
        form=form,
    )


@home.route("/quiz", methods=["GET", "POST"], endpoint="quiz")
@login_required
def quiz():
    return render_quiz_page(
        QuizPageConfig(
            mode="standard",
            template_name="quiz.html",
            endpoint_name="home.quiz",
            title="Quiz",
            description=".",
        )
    )


@home.route("/quemore", methods=["GET", "POST"], endpoint="quemore")
@login_required
def quemore():
    form = QueAdditionForm()
    UID = g._login_user.id
    category_list = get_all_categories()
    description = "Que More Questions"
    search_que_filters = get_session("search_que_filters")
    if search_que_filters == 'Not set':
        selected_categories = []
    else:
        selected_categories = search_que_filters['catz']

    return render_template(
        "quemore.html",
        title="Que More Questions",
        description=description,
        user=current_user,
        form=form,
        category_list=category_list,
        selected_categories=selected_categories,
    )


@home.route("/editquestions", methods=["GET"], endpoint="editquestions")
@login_required
def editquestions():
    UID = g._login_user.id
    form = QuestionForm()
    category_list = get_all_categories()
    question_categories = []
    filter_categories = []
    q = None
    if request.method == "GET":
        filter_categories = get_session("filter_categories")
        if filter_categories == "Not set":
            filter_categories = []

    return render_template(
        "editquestions.html",
        title="Edit or Delete Questions",
        user=current_user,
        category_list=category_list,
        selected_categories=question_categories,
        filter_categories=filter_categories,
        form=form,
        q=q,
    )


@home.route("/edit_question", methods=["GET"], endpoint="edit_question")
@login_required
def edit_question():
    q_id = request.args.get("q_id")
    category_list = get_all_categories()
    selected_categories = []
    if q_id:
        try:
            q_id_int = int(q_id)
            q_obj = session.query(question).filter_by(question_id=q_id_int).first()
            if q_obj:
                selected_categories = [c.category_name.replace(" ", "_") for c in q_obj.categories]
        except Exception as e:
            logging.error(f"Error fetching question {q_id}: {e}")

    return render_template(
            "edit_question.html",
        user=current_user,
        category_list=category_list,
        selected_categories=selected_categories,
        hide_saved_lists=True,
    )


@home.route("/studymaterials", methods=["GET", "POST"], endpoint="studymaterials")
@login_required
def studymaterials():
    logging.debug('Rendering studymaterials.html')

    return render_template(
        "studymaterials.html",
        title="Study Materials",
        user=current_user,
       )


# @home.route("/exclude_q", methods=["POST"], endpoint="exclude_q")
# @login_required
# def exclude_q():
#     UID = g._login_user.id


#     msg = "Excluded Question"
#     flash(msg, category="success")

#     response_msg = jsonify('ok')

#     return response_msg


@home.route("/topics/<selected_topic>", methods=["GET"], endpoint="topic_questions")
@login_required
def topic_questions(selected_topic):
    # Fetch the list of all topics with their question counts
    category_list = get_all_categories()

    # Fetch the questions for the selected topic
    questions = get_categories_questions(selected_topic)

    return render_template(
        "topic_questions.html",
        title=f"Questions for {selected_topic}",
        selected_topic=selected_topic,
        topics=topics,
        questions=questions
    )

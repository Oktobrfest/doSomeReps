from re import A
from typing import final
from flask import Blueprint, render_template, request, jsonify, flash, Flask, flash, redirect, url_for
from flask import current_app as app
from flask_login import current_user, login_required, logout_user

from sqlalchemy.orm import (
    Query,
    selectinload,
    joinedload,
    aliased,
    subqueryload,
    with_parent,
    contains_eager,
)
from sqlalchemy import select, Interval, join, intersect
from ..database import Base, engine, session
from ..models import category, question, q_pic, quizq, level
import re
from sqlalchemy.sql import func, exists
from sqlalchemy.sql.expression import bindparam
from flask_uploads import configure_uploads, IMAGES, UploadSet
from wtforms import FileField, StringField, validators, SubmitField, IntegerField
from flask_wtf import FlaskForm
from werkzeug.utils import secure_filename

# from ..s3upload import upload_file
from ..aws_s3 import *
from datetime import datetime, timedelta
import random
from flask import g
import copy


# Blueprint Configuration
home = Blueprint("home", __name__, template_folder="templates", static_folder="static")


class MyForm(FlaskForm):
    question_image = FileField("question_image")
    hint_image = FileField("hint_image")

    # question2 = StringField(u'Question text', validators=[validators.input_required()])

    # form upload shit


images = UploadSet("images", IMAGES)
configure_uploads(app, images)


def allowed_file(filename):
    return (
        "." in filename
        and filename.split(".", 1)[1].lower() in Config.ALLOWED_EXTENSIONS
    )


@home.route("/", methods=["GET", "POST"], endpoint="homepage")
@login_required
def homepage():
    """Homepage."""
    return render_template(
        "home.html",
        title="Homepage",
        description=".",
        user=current_user,
    )
def get_all_categories():
    category_list = []
    result = session.execute(select(category))
    category_list.extend(cat.category_name for cat in result.scalars())
    return category_list
        

@home.route("/addcontent", methods=["GET", "POST"], endpoint="addcontent")
@login_required
def addcontent():
    form = MyForm()
    category_list = get_all_categories()
    if request.method == "GET":
        return render_template(
            "addcontent.html",
            title="Add content",
            description=".",
            user=current_user,
            category_list=category_list,
            form=form,
        )

    if request.method == "POST":
        question_name = request.form.get("question_name")
        question_text = request.form.get("question_text")
        hint = request.form.get("hint")
        answer = request.form.get("answer")

        category_names = request.form.getlist("category_name")

    #  TEESTING MULTIPLE IMAGE UPLOADS

    if form.validate_on_submit():
        if len(question_name) < 1 or len(question_text) < 3 or len(answer) < 1:
            return flash("shits too short bro!", category="failure")

        existing_q_name = session.execute(
            select(question).where(question.question_name == question_name)
        ).first()
        existing_q_text = session.execute(
            select(question).where(question.question_text == question_text)
        ).first()
        if existing_q_name is not None or existing_q_text is not None:
            return flash("question already exists!", category="failure")
        selected_categories = []
        
        # create new question!
        new_question = question(
            question_name=question_name,
            question_text=question_text,
            hint=hint,
            created_on=func.now(),
            answer=answer,
            categories=selected_categories,
            # created_by= current_user.id,
        )
        # append categories so it dont glitch
        for cat_name in category_names:
            query = Query([category]).filter(category.category_name == cat_name)
            cat = query.with_session(session).first()
            new_question.categories.append(cat)

        # pictures
        answer_pics = []
        hint_image = ""
        question_image = ""

        # gather the pictures
        pic_types = {"answer_pics", "hint_image", "question_image"}
        for pic_type in pic_types:
            if pic_type in request.files:
                pictures = request.files.getlist(pic_type)
                for pic in pictures:
                    if pic and allowed_file(pic.filename):
                        # save it to web server
                        picname = secure_filename(pic.filename)
                        pic.save(os.path.join(app.config["UPLOAD_FOLDER"], picname))
                        # upload to S3
                        file_directory = "repz/home/static/"
                        file_name = file_directory + picname
                        Metadata = {
                            "x-amz-meta-question": question_name,
                            "x-amz-meta-pic_type": pic_type,
                        }
                        ExtraArgs = {"Metadata": Metadata}
                        location_string = upload_file_to_s3(
                            file_name, ExtraArgs, object_name=picname
                        )
                        new_question.pics.append(
                            q_pic(pic_string=location_string, pic_type=pic_type)
                        )

        session.add(new_question)
        session.commit()
        flash("New question created!", category="success")
        return render_template(
            "addcontent.html",
            title="Add content",
            description=".",
            user=current_user,
            category_list=category_list,
            form=form,
        )


@home.route("/add", methods=["POST"], endpoint="add")
@login_required
def add():
    newCategory = request.form.get("add_category_field", type=str)
    # validation
    er = False
    htl = ""
    if len(newCategory) < 3:
        flash("too short bro!", category="failure")
        er = True
    else:
        query = Query([category])
        result = query.with_session(session)
        for c in result:
            if newCategory == c.category_name:
                flash("category already exists")
                er = True
    data = "start val"
    if er == False:
        new_cat = category(category_name=newCategory)
        session.add(new_cat)
        session.commit()
        flash("Category created!", category="success")

        # clean up the string
        data = newCategory
        htl = clean_for_html(newCategory)
    else:
        data = ""
    return jsonify(data, htl)


def clean_for_html(unclean: str) -> str:
    unclean = re.sub(r"[^\w\s]", "", unclean)
    # Replace all runs of whitespace with a single dash
    clean = re.sub(r"\s+", "_", unclean)
    return clean.lower()


# Get list of categories
# def get_cat_list():
#     category_list = []
#     result = session.execute(select(category))
#     for cat in result.scalars():
#         cat_name = clean_for_html(cat.category_name)
#         category_list.append(cat_name)
#     category_list = category_list.sort()
#     return category_list


@home.route("/quiz", methods=["GET", "POST"], endpoint="quiz")
@login_required
def quiz():
    # Redundant
    # user_id_no = current_user.get_id()
    # UIDa = current_user.id
    UID1 = g._login_user.id
    UID = copy.copy(UID1)

    # selected_cats = request.form.getlist('category_name')
    selected_cats = ["pooping"]

    null_quizq = (
        select(quizq)
        .where(quizq.answered_on == None)
        .where(quizq.user_id == UID)
        .subquery()
    )

    quest_wCats_qry = (
        select(question, category, quizq, level.days_hence)
        .join(question.categories)
        .where(category.category_name.in_(selected_cats))
        .join(null_quizq, question.question_id == null_quizq.c.question_id)
        .join(level, null_quizq.c.level_no == level.level_no)
    )

    result = session.execute(quest_wCats_qry).unique().all()

    result_list = []
    que_list = []
    current_dt = func.now()
    now = datetime.now()
    for r in result:
        # see if it's due to be answered
        answered_on = r.quizq.answered_on
        # temp disabled
        if answered_on == None:
            addit = True
        else:
            days_hence = r.days_hence
            due_date = answered_on + timedelta(days=days_hence)
            if now > due_date:
                addit = True
            else:
                addit = False

        if addit == True:
            catz = []  # duplicate, but prob doesn't add all the categories!
            categories = []
            # didnt quite work
            # catz.append(c.category_name for c in r.question.categories)
            # catz.append(c.category_name for c in r.category)
            for c in r.question.categories:
                catz.append(c.category_name)
                for qu in c.questions:
                    if qu.question_id == r.question.question_id:
                        for cc in qu.categories:
                            categories.append(cc.category_name)
                
            pics = {k: [] for k in ["answer_pics", "hint_image", "question_image"]}
            for img in r.question.pics:
                pics[img.pic_type].append(img.pic_string)

            q = {
                "question_id": r.question.question_id,
                "question_name": r.question.question_name,
                "question_text": r.question.question_text,
                "hint": r.question.hint,
                "answer": r.question.answer,
                "level_no": r.quizq.level_no,
                "categories": categories,
                "catz_DEF_REDUNDANT": catz,
                "pics": pics,                
            }
       
            que_list.append(q)

        result_list.append(r)

    if len(que_list) < 1:
        return render_template(
        "quemore.html",
        user=current_user,
         )

    
    return render_template(
        "quiz.html",
        title="Quiz",
        description=".",
        user=current_user,
        category_list=selected_cats,
        q=que_list[0]
        # form=form,
    )


class QueAdditionForm(FlaskForm):
    qty_to_que = IntegerField("qty_to_que")
    que_more_submit = SubmitField("que_more_submit")
    

@home.route("/quemore", methods=["GET", "POST"], endpoint="quemore")
@login_required
def quemore():
    form = QueAdditionForm()
    
    UID = g._login_user.id
    category_list = get_all_categories()
    description = 'Que More Questions'
    
    if request.method == "POST":
        
        
        if form.validate_on_submit():
            qty_to_que = form.qty_to_que.data
            que_more_submit = form.que_more_submit.data
            category_names = request.form.getlist("category_name")
            
            qty_added = new_q_lookup(UID, category_names, qty_to_que)
              
            if qty_added < 1:
                description="No More Questions Left- ADD MORE"
                flash('No More Questions Left- ADD MORE')
                return redirect(url_for('add'))
                
               
            
            msg = 'You added' + qty_added + "more questions to your que!"
            flash(msg)
            return redirect(url_for('quiz'))
           
        
        
    return render_template(
        "quemore.html",
        title="Que More Questions",
        description=description,
        user=current_user,
        form=form,
        category_list=category_list,
         )
    
def new_q_lookup(UID, selected_categories, qty_to_que):
    subquery = select(question).join(quizq, question.question_id == quizq.question_id)
    subq = session.execute(subquery)
    new_q_query = select(question).where(question.question_id not in subq).limit(qty_to_que)
    new_questions = session.execute(new_q_query).scalars()
    

    new_q_quiz_list = []
    for new_question in new_questions:
        new_quizq = quizq(
            user_id=UID,
            level_no=1,
        )
        new_quizq.question_id = new_question.question_id
        new_q_quiz_list.append(new_quizq)
    qty_added = len(new_q_quiz_list)
    session.add_all(new_q_quiz_list)
    session.commit()
    
    return qty_added


# def randomizifier(question_q):
#     if question_q is not None:
#         if isinstance(question_q, list):
#             rand_q = copy.copy(random.choice(question_q))  # Crashed here. FIX THIS NEXT
#         else:
#             rand_q = copy.copy(question_q)

#         # no worked
#         # quizq_query = select(quizq).where(quizq = rand_q)
#         # random_quizq = session.execute(quizq_query).scalars()

#         # random_quizq = session.execute(rand_q).scalars()

#         return rand_q
#     else:
#         return None
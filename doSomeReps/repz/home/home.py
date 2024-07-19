from re import A
from typing import final
from flask import (
    Blueprint,
    render_template,
    request,
    jsonify,
    flash,
    flash,
    redirect,
    url_for,
    session as local_session,
    g,
    current_app as app,
    send_from_directory
)

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
from ..database import session
from ..models import category, question, q_pic, quizq, level, users, rating, excluded_questions
import re
import copy

from flask_uploads import configure_uploads, IMAGES, UploadSet
from wtforms import FileField, StringField, validators, SubmitField, IntegerField
from flask_wtf import FlaskForm
from wtforms.validators import DataRequired, NumberRange

from werkzeug.utils import secure_filename

# from ..s3upload import upload_file
from ..aws_s3 import *
import random

import os
from ..homeforms import *
from ..bluehelpers import *
import json
import math
from ..charts import *

from repz import cache
from repz.cache_helper import CacheHelper
import hashlib

# Blueprint Configuration
home = Blueprint("home", __name__, template_folder="templates", static_folder="static")
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
    form = questionForm()
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

    if request.method == "POST":
        question_text = request.form.get("question_text")
        hint = request.form.get("hint")
        answer = request.form.get("answer")
        privacy_chkbox = request.form.get("privacy-checkbox")
        if privacy_chkbox == "on":
            privacy = True
        else:
            privacy = False        

        category_names = request.form.getlist("category_name")

        #remove the html versions underscores
        spaced_cats = list(map(lambda x: remove_underscore(x), category_names))

    #  TEESTING MULTIPLE IMAGE UPLOADS
    if form.validate_on_submit():
        fail = False
        if len(question_text) < 3 or len(answer) < 1:
            flash("Question text is too short!", category="failure")
            fail = True
        existing_q_text = session.execute(
            select(question).where(question.question_text == question_text)
        ).first()
        if existing_q_text is not None:
            flash("question already exists!", category="failure")
            fail = True
        if len(category_names) < 1:
            fail = True
            flash("You must select at least one category!", category="failure")
        if fail == True:
            return redirect(url_for("home.addcontent"))

        selected_categories = []

        # create new question!
        new_question = question(
            question_text=question_text,
            hint=hint,
            created_on=func.now(),
            answer=answer,
            categories=selected_categories,
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
            new_quizq(question_ids, current_user.id)

        flash("New question created!", category="success")

        selected_categories = category_names
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
    UID = g._login_user.id
    cats_due = []

    category_list = get_all_categories()
    time_now = func.now()
    if request.method == "GET":
        selected_categories = get_session("quiz_category_names")
        if selected_categories == "Not set":
            msg = "You need to select some question categories."
            flash(msg)
            return render_template(
                "quiz.html",
                title="Quiz",
                description=".",
                user=current_user,
                category_list=category_list,
                q="",
                selected_categories=selected_categories
            )
    else:
        selected_categories = request.form.getlist("category_name")
        set_session("quiz_category_names", selected_categories)

    cache_helper = CacheHelper(UID)
    que_list, que_cache_key = cache_helper.get_cached_questions(selected_categories)

    if request.method == "POST":
        incorrect_submit = request.form.get("incorrect_submit")
        correct_submit = request.form.get("correct_submit")
        quizq_id_str = request.form.get("quizq-id")
        start_quiz = request.form.get("start-quiz")
        provided_answer = request.form.get("provided-answer")        
        exclude_question = request.form.get("exclude-question-button")
        if quizq_id_str is not None:
            quizq_id = int(quizq_id_str)
        else:
            quizq_id = ""


        # exclude question                                    
        if ((start_quiz == None) and 
            (exclude_question == "exclude")):
            cur_user = get_user(UID)

            # get current question id via quiz_id
            q_id_qry = select(quizq.question_id).where(quizq.quizq_id == quizq_id)
            q_id = session.execute(q_id_qry).scalar()

            excluded_q_qry = select(question).where(question.question_id == q_id)

            excluded_q_obj = session.execute(excluded_q_qry).first()[0]

            cur_user.excluded_questions.append(excluded_q_obj)

            #remove from cache
            if len(que_list) > 0: 
                for i, q in enumerate(que_list):
                    if q['quizq_id'] == quizq_id:
                        que_list.pop(i)
                        break
                cache.set(que_cache_key, que_list, timeout=600)
            session.add(cur_user)
            
        # if it's a correct/incorrect answer
        if (start_quiz == None) and (
            (correct_submit == "Correct!") or (incorrect_submit == "Wrong!")
        ):
            qry = (
                select(quizq)
                .where(quizq.answered_on == None)
                .where(quizq.user_id == UID)
                .where(quizq.quizq_id == quizq_id)
            )
            current_quiz = session.execute(qry).scalars().all()
            # print(qry)

            # set fields applicable to both possibilities (completed date & by whom)
            update_stmt = (
                update(quizq)
                .where(quizq.quizq_id == current_quiz[0].quizq_id)
                .values(answered_on=time_now, provided_answer = provided_answer)
            )

            if correct_submit == "Correct!":
                # get the max level
                max_lvl = session.execute(select(func.max(level.level_no))).scalar()
                if current_quiz[0].level_no < max_lvl:
                    new_lvl = current_quiz[0].level_no + 1
                else:  # None signifies the question is complete and no more levels left
                    new_lvl = None
                update_stmt = update_stmt.values(correct=True)
            #remove from cache
                if que_list is not None:    
                    for i in range(len(que_list) - 1, -1, -1):
                        if que_list[i]["quizq_id"] == quizq_id:
                            c = que_list.pop(i)
                            break
                    cache.set(que_cache_key, que_list, timeout=600) 
            elif incorrect_submit == "Wrong!":
                update_stmt = update_stmt.values(correct=False)
                new_lvl = 1
                if len(que_list) > 0:
                    que_list = [q for q in que_list if q["quizq_id"] != quizq_id or (w := q, False)[1]]      
                    cache.set(que_cache_key, que_list, timeout=600) 
          
            
            
            # next create a new quizQ Level for that question
            if new_lvl != None:
                new_quizq = quizq(
                    question_id=current_quiz[0].question_id,
                    user_id=UID,
                    level_no=new_lvl,
                )
                # Create new quiz Q
                session.add(new_quizq)
                session.commit()                

        # print(str(session.query(quizq).filter_by(user_id=UID, level_no=new_lvl)))
        
              # Execute the update statement for the answered quiz question
            session.execute(update_stmt)
            session.commit()
            
            # follow PRG Pattern (post redirect get) to prevent double-posting
            return redirect(url_for("home.quiz"))
     
        if len(selected_categories) < 1:
            # FAILED VALIDATION'
            msg = "You didn't select any question categories! Try again."
            flash(msg)
            return render_template(
                "quiz.html",
                title="Quiz",
                description=".",
                user=current_user,
                category_list=category_list,
                q=""
                # form=form,
            )
            

    if len(que_list) < 1:
        selected_cats = [ remove_underscore(x) for x in selected_categories ]
        que_list = get_quizes(selected_cats, UID)
        cache.set(que_cache_key, que_list, timeout=600)     

    success_msg = "Congradulations! You've completed all the questions currently due! You have two options: Either wait for the questions you've already answered to come due again, or to start answering more questions immediately you need to expand your training que! For the ladder option, select how many more questions you'd like to add to your que below and click 'Add More'"
    # if no questions are due to be answered give user the option to add more or select more categories.
    if len(que_list) < 1:
        # see if all the categories have been searched through
        if len(selected_categories) == len(category_list):
            flash(success_msg)
            return redirect(url_for("home.quemore"))
        # give the user a list of categories for which he has quizes due
        else:
            unselected_cat_quizes = get_quizes(category_list, UID)
            if len(unselected_cat_quizes) < 1:
                flash(success_msg)
                return redirect(url_for("home.quemore"))
            else:
                cats_w_quizes = tally_que_catz(unselected_cat_quizes)
                # add the tally to a string
                cats_due_txt = ""
                for cat, num in cats_w_quizes.items():
                    cats_due_txt += f"{cat}: {num}, "
                    cleaned_cat = clean_for_html(cat)
                    cats_due.append(cleaned_cat)

                # MAKE A MESSAGE TELLING USER WHAT CATS TO SELECT FOR MORE QUIZES
                msg_txt =  "No more questions in your selected categories are currently due. Either que more questions for those categories or select the following categories which have questions due: "
                msg = msg_txt + cats_due_txt
            flash(msg)
        q = ""
    else:
        # sort by date
        # sorted_que_list = sorted(que_list, key=lambda k: k['last_ansered']) 
        sorted_que_list = sorted(que_list, key=lambda k: (k['last_ansered'] is None, k['last_ansered']))
        if len(sorted_que_list) > 30:
            sorted_que_list = sorted_que_list[:17]
        else:
            sorted_que_list = sorted_que_list[:7]
        q = random.choice(sorted_que_list)
        
    return render_template(
        "quiz.html",
        title="Quiz",
        description=".",
        user=current_user,
        category_list=category_list,
        q=q,
        selected_categories=selected_categories,
        cats_due=cats_due
    )

@home.route("/quemore", methods=["GET", "POST"], endpoint="quemore")
@login_required
def quemore():
    # local_session['_flashes'].clear()
    zz = 'z'
    x = local_session
    # x.clear()
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
    form = questionForm()
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







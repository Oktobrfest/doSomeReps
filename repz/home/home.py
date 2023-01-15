from re import A
from typing import final
from flask import Blueprint, render_template, request, jsonify, flash, Flask, flash, redirect, url_for, session as local_session
from flask import jsonify, make_response, g, current_app as app
from flask_login import current_user, login_required, logout_user

from sqlalchemy.orm import (
    Query,
    selectinload,
    joinedload,
    aliased,
    subqueryload,
    with_parent,
    contains_eager
   )
from sqlalchemy.sql import func, exists, distinct
from sqlalchemy.sql.expression import bindparam
from sqlalchemy import select, Interval, join, intersect, update, not_, except_, and_, or_, text
from ..database import Base, engine, session
from ..models import category, question, q_pic, quizq, level
import re

from flask_uploads import configure_uploads, IMAGES, UploadSet
from wtforms import FileField, StringField, validators, SubmitField, IntegerField
from flask_wtf import FlaskForm
from wtforms.validators import DataRequired, NumberRange

from werkzeug.utils import secure_filename

# from ..s3upload import upload_file
from ..aws_s3 import *
from datetime import datetime, timedelta
import random
import copy

import os 
from flask import send_from_directory     

from ..homeforms import *
from ..bluehelpers import *



@app.route('/favicon.ico') 
def favicon(): 
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')


# Blueprint Configuration
home = Blueprint("home", __name__, template_folder="templates", static_folder="static")


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
        

@home.route("/addcontent", methods=["GET", "POST"], endpoint="addcontent")
@login_required
def addcontent():
    form = questionForm()
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
        fail = False
        if len(question_name) < 1 or len(question_text) < 3 or len(answer) < 1:
            flash("Question Name is too short bro!", category="failure")
            fail = True
        existing_q_name = session.execute(
            select(question).where(question.question_name == question_name)
        ).first()
        existing_q_text = session.execute(
            select(question).where(question.question_text == question_text)
        ).first()
        if existing_q_name is not None or existing_q_text is not None:
           flash("question already exists!", category="failure")
           fail = True
        
        if fail == True:
            return redirect(url_for('home.addcontent'))
        
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
        
        auto_que = request.form.get("automatically-que-created-question")
 
        if auto_que == 'on':
            question_ids = [ new_question.question_id ]
            new_quizq(question_ids, current_user.id)
            
        
        flash("New question created!", category="success")
        return render_template(
            "addcontent.html",
            title="Add content",
            description=".",
            user=current_user,
            category_list=category_list,
            form=form,
        )
        
def allowed_file(filename):
    return (
        "." in filename
        and filename.split(".", 1)[1].lower() in Config.ALLOWED_EXTENSIONS
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

@home.route("/quiz", methods=["GET", "POST"], endpoint="quiz")
@login_required
def quiz():
    # Redundant
    # user_id_no = current_user.get_id()
    # UIDa = current_user.id
    UID1 = g._login_user.id
    UID = copy.copy(UID1)
    category_list = get_all_categories()
    time_now = func.now()
    if request.method == 'GET':
        selected_categories = get_session('quiz_category_names')
        if selected_categories == 'Not set':
            msg = "You need to select some question categories."
            flash(msg)
            return render_template(
                 "quiz.html",
                    title="Quiz",
                    description=".",
                    user=current_user,
                    category_list=category_list,
                    q=''
                    # form=form,
                )
          
    if request.method == "POST":
        selected_categories = request.form.getlist("category_name")
        incorrect_submit = request.form.get("incorrect_submit")
        correct_submit = request.form.get("correct_submit")
        quizq_id = request.form.get("quizq-id")
        start_quiz = request.form.get("start-quiz")
              
        # if it's a correct/incorrect answer
        if ((start_quiz == None) and ((correct_submit == 'Correct!') or (incorrect_submit == 'Wrong!'))):
            qry = select(quizq).where(quizq.answered_on == None).where(quizq.user_id == UID).where(quizq.quizq_id == quizq_id)
            current_quiz = session.execute(qry).scalars().all()
      
            #set fields applicable to both possibilities (completed date & by whom)
            update_stmt = (
                update(quizq)
                .where(quizq.quizq_id == current_quiz[0].quizq_id)
                .values(answered_on = time_now)
                )
        
            if correct_submit == 'Correct!':
                # get the max level
                max_lvl = session.execute(select(func.max(level.level_no))).scalar()
                if current_quiz[0].level_no < max_lvl:
                    new_lvl = (current_quiz[0].level_no + 1)
                else: # None signifies the question is complete and no more levels left
                    new_lvl = None
                    
                update_stmt = update_stmt.values(correct = True)
            elif incorrect_submit == 'Wrong!':
                update_stmt = update_stmt.values(correct = False)
                new_lvl = 1
                
            # Execute the update statement
            updated_quizq = session.execute(update_stmt)
                        
            #next create a new quizQ Level for that question
            if new_lvl != None:
                new_quizq = quizq(
                question_id = current_quiz[0].question_id,
                user_id = UID,
                level_no = new_lvl       
                )            
            #Create new quiz Q
                session.add(new_quizq)
                session.commit()
                
        if len(selected_categories) < 1:
            # FAILED VALIDATION'
            msg = "You idiot! You didn't select any question categories! Try again."
            flash(msg)
            return render_template(
                 "quiz.html",
                    title="Quiz",
                    description=".",
                    user=current_user,
                    category_list=category_list,
                    q=''
                    # form=form,
                )
        else:
            set_session('quiz_category_names', selected_categories)
        
    selected_cats = selected_categories
    
    quest_wCats_qry = (
    select(question, category, quizq, level.days_hence)
    .join(question.categories)
    .where(category.category_name.in_(selected_cats))
    .join(quizq, and_(question.question_id == quizq.question_id, quizq.user_id == UID, quizq.answered_on.is_(None)))
    .join(level, quizq.level_no == level.level_no)
)  

    result = session.execute(quest_wCats_qry.distinct()).all()

    result_list = []
    que_list = []
    now = datetime.now()
    for r in result:
        # see if it's due to be answered- (levels 2+)
        if r.quizq.level_no > 1:
            # find the quiz question that was answered before it and grab that datetime
            previous_level = (r.quizq.level_no - 1)
            previous_quizq = (
                select(quizq.answered_on)
                .where(quizq.user_id == UID)
                .where(quizq.question_id == r.quizq.question_id)
                .where(quizq.level_no == previous_level)
                .where(quizq.correct == True)
                .order_by(quizq.answered_on.desc())
            )
            previous_quizq_date = session.execute(previous_quizq.distinct()).scalars().first()
            answered_on = previous_quizq_date
            days_hence = r.days_hence
            due_date = answered_on + timedelta(days=days_hence)
            if now > due_date:
                addit = True
            else:
                addit = False
        else: 
            addit = True # if it's level #1

        if addit == True:
            catz = []  # duplicate, but prob doesn't add all the categories!
            categories = []
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
                "quizq_id": r.quizq.quizq_id,
                "question_name": r.question.question_name,
                "question_text": r.question.question_text,
                "hint": r.question.hint,
                "answer": r.question.answer,
                "level_no": r.quizq.level_no,
                "categories": catz,
                "catz_DEF_REDUNDANT": catz,
                "pics": pics,                
            }
       
            que_list.append(q)

        result_list.append(r)

    # if no questions are due to be answered give user the option to add more or select more categories.
    if len(que_list) < 1:
        # see if all the categories have been searched through
        if (len(selected_categories) == len(category_list)):
            msg = "Congradulations! You've completed all the questions currently due! You have two options: Either wait for the questions you've already answered to come due again, or to start answering more questions immediately you need to expand your training que! For the ladder option, select how many more questions you'd like to add to your que below and click 'Add More'"
                     
            flash(msg)
            return redirect(url_for('home.quemore'))
        else:
            flash('No more questions in your selected categories are currently due. Either try to select more categories or que more questions for those categories')
    
    try:
        que_list[0]
    except:
        q = ''
    else:
        q = que_list[0]
               
    return render_template(
        "quiz.html",
        title="Quiz",
        description=".",
        user=current_user,
        category_list=category_list,
        q=q,
        selected_categories=selected_categories
        # form=form,
    )
    

@home.route("/quemore", methods=["GET", "POST"], endpoint="quemore")
@login_required
def quemore():
    form = QueAdditionForm()
    
    UID = g._login_user.id
    category_list = get_all_categories()
    description = 'Que More Questions'
    
    selected_categories = get_session('que_category_names')
    
    if form.validate_on_submit():
        qty_to_que = form.qty_to_que.data
        que_more_submit = form.que_more_submit.data
        selected_categories = request.form.getlist("category_name")
        
        #validate that categories have been selected
        if len(selected_categories) < 1:
            msg = "You idiot! You didn't select any question categories! Try again."
            flash(msg)
            return render_template(
                "quemore.html",
                title="Que More Questions",
                description=description,
                user=current_user,
                form=form,
                category_list=category_list,
            )
        else:
            set_session('que_category_names', selected_categories)        
        
        qty_added = new_q_lookup(UID, selected_categories, qty_to_que)
            
            # if all the categories are selected redirect to make more questions otherwise/message telling them to select more categories
        if qty_added < 1:
            if (len(selected_categories) == len(category_list)):
                flash("You already added all the questions into your que. There are no more questions left to add. You need to make more questions if you'd like to expand your que")
                return redirect(url_for('home.addcontent'))
            else:
                flash('No more questions in your selected categories are left to que up. Either try to select more categories or create more questions for your chosen categories')
                description="Select more categories or create more questions"
                return redirect(url_for('home.quemore'))
        # success
        msg = 'You added ' + str(qty_added) + " more question(s) to your que!"
        flash(msg)
        return redirect(url_for('home.quiz'))

                
    return render_template(
        "quemore.html",
        title="Que More Questions",
        description=description,
        user=current_user,
        form=form,
        category_list=category_list,
        selected_categories=selected_categories
         )
    




@home.route("/editquestions", methods=["GET", "POST"], endpoint="editquestions")
@login_required
def editquestions():
    
    UID1 = g._login_user.id
    UID = copy.copy(UID1)
    form = questionForm()
    category_list = get_all_categories()
    question_categories = []
    filter_categories = []
    q = None
    if request.method == "GET":
        filter_categories = get_session('filter_categories')
        if filter_categories == 'Not set':
            filter_categories = []
    

    
   
    
     

    return render_template(
        "editquestions.html",
        title="Edit or Delete Questions",
        user=current_user,
        category_list=category_list,
        selected_categories=question_categories,
        filter_categories=filter_categories,
        form = form,
        q=q
         )
    
    
@home.route("/searchq", methods=["POST"], endpoint="searchq")
@login_required
def searchq():
    
    # get The submitted Json values
    filters = request.get_json()
    set_session('filter_categories', filters)  
    
    filter_cats = filters['search-categories']
    
    #query db
   # list of column names to search
    column_names = filters['search-within'] 
    #equest.json['search-within'] #['column1', 'column2', 'column3']

    # the value to search for
    search_value = filters['search-terms']

    # build the query
    query = session.query(question, category).options(joinedload(question.categories)).join(question.categories).filter(category.category_name.in_(filter_cats))
    
    # query = session.query(question.question_name, question.question_id, category, category.category_name).join(question.categories).filter(category.category_name.in_(filter_cats))
    for column_name in column_names:
        query = query.filter(or_(getattr(question, column_name).contains(search_value)))

    # execute the query
    results = query.all()
        
    search_results = []
    for r in results:
       catz = []
       for c in r.question.categories:
           catz.append(c.category_name)

       q = {
            'question_name': r.question.question_name,
            'question_id': r.question.question_id,
            'categories': catz
       }
       search_results.append(q)

    search_response = jsonify(search_results)
    msg = 'suck sess'
    flash(msg, category="success")
    return search_response


@home.route("/getq", methods=["POST"], endpoint="getq")
@login_required
def getq():
    
    # get The submitted Json values
    question_id = request.get_json()
    
    # qry = select(question).where(question.question_id == question_id)
   
    # qry = session.query(question).options(joinedload(question.pics)).filter(question.question_id == question_id)
    # question_obj = qry.first()

    # qry = select([question, q_pic]).select_from(question.join(q_pic, question.question_id == q_pic.question_id)).where(question.question_id == question_id)
          
    # question_obj = session.execute(qry).first()
    
    # qry = session.query(question, q_pic).join(q_pic, question.question_id == q_pic.question_id).filter(question.question_id == question_id)
    # question_obj = qry.all()
    
        # print(str(qry))
    # print('query string follows:::::::::::::::::::::::::::')
    # print(str(qry.statement.compile(compile_kwargs={"literal_binds": True})))
    
    question_obj = session.query(question).outerjoin(q_pic, question.question_id == q_pic.question_id).filter(question.question_id == question_id).first()

    # pics_by_type = {
    # "hint": [],
    # "answer": [],
    # "question": []
    # }
    
    # if question_obj.pics:
    #     hint_pics = [pic for pic in question_obj.pics if pic.pic_type == "hint_image"]
    #     answer_pics = [pic for pic in question_obj.pics if pic.pic_type == "answer_pics"]
    #     question_pics = [pic for pic in question_obj.pics if pic.pic_type == "question_image"]

    # for pic in hint_pics:
    #     p = { 'pic_string': pic.pic_string, 'pic_id': pic.pic_id }
    #     pics_by_type["hint"].append(p)
    # for pic in answer_pics:
    #     p = { 'pic_string': pic.pic_string, 'pic_id': pic.pic_id }
    #     pics_by_type["answer"].append(p)
    # for pic in question_pics:
    #     p = { 'pic_string': pic.pic_string, 'pic_id': pic.pic_id }
    #     pics_by_type["question"].append(p)
    
    pics_by_type = {
    "hint": [],
    "answer": [],
    "question": []
}
    # if question_obj.pics:
    #     pic_type_map = {"hint_image": "hint", "answer_pics": "answer", "question_image": "question"}
    #     for pic in question_obj.pics:
    #         pic_type = pic_type_map.get(pic.pic_type)
    #         if pic_type:
    #             p = { 'pic_string': pic.pic_string, 'pic_id': pic.pic_id }
    #             pics_by_type[pic_type].append(p)
    if question_obj.pics:
        pic_type_map = {"hint_image": "hint", "answer_pics": "answer", "question_image": "question"}
        for pic_type, type_name in pic_type_map.items():
            pics = [pic for pic in question_obj.pics if pic.pic_type == pic_type]
            pics_by_type[type_name] = [{ 'pic_string': pic.pic_string, 'pic_id': pic.pic_id } for pic in pics]

            
    q = {
            'question_name': question_obj.question_name,
            'question_text': question_obj.question_text,
            'hint': question_obj.hint,
            'answer': question_obj.answer,
            'pics_by_type': pics_by_type,
        }

    
        # threw error for obj in question_obj[0]._data[1]:
    #     pics_by_type[obj.q_pic.pic_type].append(obj.q_pic.pic_string)
      # 'question_name': question_obj[0]._data[0].question_name,
            # 'question_text': question_obj[0]._data[0].question_text,
            # 'hint': question_obj[0]._data[0].hint,
            # 'answer': question_obj[0]._data[0].answer,
       
    res_q = jsonify(q)
    msg = 'mkay'
    flash(msg, category="success")
    
    response = make_response(res_q)
    # response.headers['Access-Control-Allow-Origin'] = '*'
   
    return response
    
    
@home.route("/editq", methods=["POST"], endpoint="editq")
@login_required
def editq():
    
    # get The submitted Json values
    question_id = request.get_json()
    
    qry = select(question).where(question.question_id == question_id).first()
    question_obj = session.execute(qry).scalars()
    
    q = {
            'question_name': question_obj.question_name,
            'question_text': question_obj.question_text,
            'hint': question_obj.hint,
            'answer': question_obj.answer,
            }
        
    res_q = jsonify(q)
    msg = 'suck sess'
    flash(msg, category="success")
    return res_q


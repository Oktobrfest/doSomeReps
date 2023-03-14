from re import A
from typing import final
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
from ..database import Base, engine, session
from ..models import category, question, q_pic, quizq, level, users, rating
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
import json

@app.route("/favicon.ico")
def favicon():
    return send_from_directory(
        os.path.join(app.root_path, "static"),
        "favicon.ico",
        mimetype="image/vnd.microsoft.icon",
    )


# Blueprint Configuration
home = Blueprint("home", __name__, template_folder="templates", static_folder="static")


@home.route("/", methods=["GET", "POST"], endpoint="homepage")
@login_required
def homepage():
    """Homepage."""
    UID1 = g._login_user.id
    UID = copy.copy(UID1)
    
    # display list of favorate users
    # didnt work session.execute(select(favorate_user, users.username).join(favorate_user.user_id == users.id)).where(users.id == UID).all()
    
    # query = session.query(FavoriteUser, users)\
    # .join(users, FavoriteUser.favorite_user_id == users.id)\
    # .filter(FavoriteUser.user_id == UID)
    
    # favs = query.all()
    
    b_user_qry = select(users).where(users.id == 1)
    b_user = session.execute(b_user_qry).first()
                            
    c_user_qry = select(users).where(users.id == 2)
    c_user = session.execute(c_user_qry).first()
    
    d_user_qry = select(users).where(users.id == 3)
    d_user = session.execute(d_user_qry).first()
    
    quest_qury = select(question).where(question.question_id == 23)
    quest = session.execute(quest_qury).first()
    qq = 'q'
    for q in quest:
        qq = q    
    
    
    
    
    # user_b = b_user_qry.with_session(session).first()
    # user_c = c_user_qry.with_session(session).first()
    cc = 'c'
    for c in c_user:
        cc = c
    
    bb = 'b'
    for b in b_user:
        bb = b
        
    dd = 'd'
    for d in d_user:
        dd = d    
        
    dd.excluded_questions.append(qq)  
    #dd.blocked_users.append(cc)  

    # b_user.favorates.append(c_user)    
    session.add(dd)
    session.commit()     
                    
        
    favorates = []
    # for fav in c_user:
    #     favorates.append(fav)
    #     print(str(b_user.favorates.append(fav)))
    #     b_user.favorates.append(fav)
    
    # aaaa = 'a'
    
    return render_template(
        "home.html",
        title="Homepage",
        description=".",
        favorates=favorates,
        user=current_user,
    )


@home.route("/addcontent", methods=["GET", "POST"], endpoint="addcontent")
@login_required
def addcontent():
    UID1 = g._login_user.id
    UID = copy.copy(UID1)
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
        privacy_chkbox = request.form.get("privacy-checkbox")
        if privacy_chkbox == "on":
            privacy = True
        else:
            privacy = False
        

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
            return redirect(url_for("home.addcontent"))

        selected_categories = []

        # create new question!
        new_question = question(
            question_name=question_name,
            question_text=question_text,
            hint=hint,
            created_on=func.now(),
            answer=answer,
            categories=selected_categories,
            created_by=UID,
            privacy=privacy
        )
        # append categories so it dont glitch
        for cat_name in category_names:
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
                q=""
                # form=form,
            )

    if request.method == "POST":
        selected_categories = request.form.getlist("category_name")
        incorrect_submit = request.form.get("incorrect_submit")
        correct_submit = request.form.get("correct_submit")
        quizq_id = request.form.get("quizq-id")
        start_quiz = request.form.get("start-quiz")

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

            # set fields applicable to both possibilities (completed date & by whom)
            update_stmt = (
                update(quizq)
                .where(quizq.quizq_id == current_quiz[0].quizq_id)
                .values(answered_on=time_now)
            )

            if correct_submit == "Correct!":
                # get the max level
                max_lvl = session.execute(select(func.max(level.level_no))).scalar()
                if current_quiz[0].level_no < max_lvl:
                    new_lvl = current_quiz[0].level_no + 1
                else:  # None signifies the question is complete and no more levels left
                    new_lvl = None

                update_stmt = update_stmt.values(correct=True)
            elif incorrect_submit == "Wrong!":
                update_stmt = update_stmt.values(correct=False)
                new_lvl = 1

            # Execute the update statement
            updated_quizq = session.execute(update_stmt)

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
                q=""
                # form=form,
            )
        else:
            set_session("quiz_category_names", selected_categories)

    selected_cats = selected_categories
    
    quest_wCats_qry = (
        select(question, category, quizq, level.days_hence)
        .join(question.categories)
        .where(category.category_name.in_(selected_cats))
        .join(
            quizq,
            and_(
                question.question_id == quizq.question_id,
                quizq.user_id == UID,
                quizq.answered_on.is_(None),
            ),
        )
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
            previous_level = r.quizq.level_no - 1
            previous_quizq = (
                select(quizq.answered_on)
                .where(quizq.user_id == UID)
                .where(quizq.question_id == r.quizq.question_id)
                .where(quizq.level_no == previous_level)
                .where(quizq.correct == True)
                .order_by(quizq.answered_on.desc())
            )
            previous_quizq_date = (
                session.execute(previous_quizq.distinct()).scalars().first()
            )
            answered_on = previous_quizq_date
            days_hence = r.days_hence
            due_date = answered_on + timedelta(days=days_hence)
            if now > due_date:
                addit = True
            else:
                addit = False
        else:
            addit = True  # if it's level #1

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

            creator = select(users.username).where(users.id == r.question.created_by)  
        
            creator_username = session.execute(creator).first()[0]  
            
            rating = score(r.question.question_id)
            
            q = {
                "quizq_id": r.quizq.quizq_id,
                "question_name": r.question.question_name,
                "question_text": r.question.question_text,
                "hint": r.question.hint,
                "answer": r.question.answer,
                "created_by": creator_username,
                "rating": rating,
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
        if len(selected_categories) == len(category_list):
            msg = "Congradulations! You've completed all the questions currently due! You have two options: Either wait for the questions you've already answered to come due again, or to start answering more questions immediately you need to expand your training que! For the ladder option, select how many more questions you'd like to add to your que below and click 'Add More'"

            flash(msg)
            return redirect(url_for("home.quemore"))
        else:
            flash(
                "No more questions in your selected categories are currently due. Either try to select more categories or que more questions for those categories"
            )

    try:
        que_list[0]
    except:
        q = ""
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
    description = "Que More Questions"
    selected_categories = get_session("que_category_names")

    if form.validate_on_submit():
        qty_to_que = form.qty_to_que.data
        que_more_submit = form.que_more_submit.data
        selected_categories = request.form.getlist("category_name")

        # validate that categories have been selected
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
            set_session("que_category_names", selected_categories)

        qty_added = new_q_lookup(UID, selected_categories, qty_to_que)

        # if all the categories are selected redirect to make more questions otherwise/message telling them to select more categories
        if qty_added < 1:
            if len(selected_categories) == len(category_list):
                flash(
                    "You already added all the questions into your que. There are no more questions left to add. You need to make more questions if you'd like to expand your que"
                )
                return redirect(url_for("home.addcontent"))
            else:
                flash(
                    "No more questions in your selected categories are left to que up. Either try to select more categories or create more questions for your chosen categories"
                )
                description = "Select more categories or create more questions"
                return redirect(url_for("home.quemore"))
        # success
        msg = "You added " + str(qty_added) + " more question(s) to your que!"
        flash(msg)
        return redirect(url_for("home.quiz"))

    return render_template(
        "quemore.html",
        title="Que More Questions",
        description=description,
        user=current_user,
        form=form,
        category_list=category_list,
        selected_categories=selected_categories,
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


@home.route("/searchq", methods=["POST"], endpoint="searchq")
@login_required
def searchq():

    # get The submitted Json values
    filters = request.get_json()
    set_session("filter_categories", filters)

    filter_cats = filters["search-categories"]

    # query db
    # list of column names to search
    column_names = filters["search-within"]
    # equest.json['search-within'] #['column1', 'column2', 'column3']

    # the value to search for
    search_value = filters["search-terms"]

    # build the query
    query = (
        session.query(question, category)
        .options(joinedload(question.categories))
        .join(question.categories)
        .filter(category.category_name.in_(filter_cats))
    )

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
            "question_name": r.question.question_name,
            "question_id": r.question.question_id,
            "categories": catz,
        }
        search_results.append(q)

    search_response = jsonify(search_results)
    return search_response


@home.route("/getq", methods=["POST"], endpoint="getq")
@login_required
def getq():
    # get The submitted Json values
    question_id = request.get_json()

    question_obj = (
        session.query(question)
        .outerjoin(q_pic, question.question_id == q_pic.question_id)
        .filter(question.question_id == question_id)
        .first()
    )

    pics_by_type = {"hint": [], "answer": [], "question": []}
    if question_obj.pics:
        pic_type_map = {
            "hint_image": "hint",
            "answer_pics": "answer",
            "question_image": "question",
        }
        for pic_type, type_name in pic_type_map.items():
            pics = [pic for pic in question_obj.pics if pic.pic_type == pic_type]
            pics_by_type[type_name] = [
                {"pic_string": pic.pic_string, "pic_id": pic.pic_id} for pic in pics
            ]

    q = {
        "question_name": question_obj.question_name,
        "question_text": question_obj.question_text,
        "hint": question_obj.hint,
        "answer": question_obj.answer,
        "id": question_obj.question_id,
        "pics_by_type": pics_by_type,
        "categories": [c.category_name for c in question_obj.categories],
        "privacy": question_obj.privacy,
    }

    res_q = jsonify(q)
    response = make_response(res_q)
    # response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@home.route("/saveq", methods=["POST"], endpoint="saveq")
@login_required
def saveq():
    # print the form data
    print(request.form)

    # retrieve the updated question data
    updated_question_json = request.form['updated_question']
    
    # convert the JSON string to a Python object
    updated_question = json.loads(updated_question_json)
    
    # loop through the database pics and see if they match the ones in the request
    q = session.query(question).filter_by(question_id=updated_question['id']).first()
    
    # Check if any existing images need to be deleted
    for pic in q.pics:
        if pic.pic_type == "hint_image":
            if pic.pic_string not in set(updated_question['pics_by_type']['hint']):
                delete_pic(pic)
        elif pic.pic_type == "answer_pics":
            if pic.pic_string not in set(updated_question["pics_by_type"]["answer"]):
               delete_pic(pic)
        elif pic.pic_type == "question_image":
            if pic.pic_string not in set(updated_question["pics_by_type"]["question"]):
                delete_pic(pic)  
    
    save_pictures(q, request)
    
    privacy = updated_question['privacy']
    # if privacy == "on":
    #     privacy = True
    # else:
    #     privacy = False
    
    session.query(question).filter(question.question_id == updated_question['id']).update(
        {
            "question_name": updated_question['question_name'],
            "question_text": updated_question['question_text'],
            "hint": updated_question['hint'],
            "answer": updated_question['answer'],
            "privacy": privacy,
        },
        synchronize_session=False,
    )
    
    # update question categories
    selected_cats = session.query(category).filter(category.category_name.in_(updated_question['categories'])).all()

    # update the categories associated with the question
    q.categories = selected_cats

    # commit the changes to the database
    session.commit()

    msg = "Question Saved"
    flash(msg, category="success")
    return msg

@home.route("/deleteq", methods=["POST"], endpoint="deleteq")
@login_required
def deleteq():
    delete_q = request.get_json()
    q = session.execute(
            select(question).where(question.question_id == delete_q["id"])
        ).first()
    
    q = session.query(question).options(joinedload(question.pics)).filter_by(question_id=delete_q["id"]).first()

# gather the q_pics and remove them from s3
    q_pics = q.pics

# loop over the q_pics and delete their corresponding objects in S3
    for pic in q_pics:
        delete_pic(pic)
    
    session.delete(q)
    session.commit()
    msg = "Question Deleted"
    flash(msg, category="success")
    return msg

def save_pictures(question, request):
    pic_types = {"answer_pics", "hint_image", "question_image"}
    for pic_type in pic_types:
        if pic_type in request.files:
            pictures = request.files.getlist(pic_type)
            for pic in pictures:
                if pic and allowed_file(pic.filename):
                    picname = secure_filename(pic.filename)
                    pic.save(os.path.join(app.config["UPLOAD_FOLDER"], picname))
                    file_directory = "repz/home/static/"
                    file_name = file_directory + picname
                    Metadata = {
                        "x-amz-meta-question": question.question_name,
                        "x-amz-meta-pic_type": pic_type,
                    }
                    ExtraArgs = {"Metadata": Metadata}
                    location_string = upload_file_to_s3(
                        file_name, ExtraArgs, object_name=picname
                    )
                    question.pics.append(
                        q_pic(pic_string=location_string, pic_type=pic_type)
                    )
    session.commit()                
    return question

def delete_pic(pic):
        file_key = os.path.basename(pic.pic_string)
        is_delete_success = delete_s3_object(file_key)
        if is_delete_success:
            session.delete(pic)
            # try:
            #     s3_client.head_object(Bucket=Config.BUCKET, Key=file_key)
            #     exists = True
            # except botocore.exceptions.ClientError as e:
            #     if e.response['Error']['Code'] == "404":
            #         exists = False
            #     else:
            #         raise
            # print(f"Object exists in bucket: {exists}")
            # resp = s3_client.list_objects_v2(Bucket=Config.BUCKET, Prefix=file_key)
            # if 'Contents' in resp:
            #     for obj in resp['Contents']:
            #         print(f"Object key: {obj['Key']}")
            # else:
            #     print("No objects found in bucket")
        else:
            flash('Failed to delete picture from S3 Bucket!', category="failure")     
            
            
            
            
@home.route("/searchquefilters", methods=["POST"], endpoint="searchquefilters")
@login_required
def searchquefilters():
    UID = g._login_user.id
    filters = request.get_json()
    # okay, first get the users questions. So long as they selected personal. Add that to the que_list!
    # doesn't work cuz quizq needs to be only for the user
    if filters['personal'] == True:
        # first grab all that users questions within the categories selected
        all_usr_qs_qry = select(question).join(question.categories).where(category.category_name.in_(filters['catz'])).where(question.created_by == UID)
        
        # then grab all the quiz_qs for that user. You can use the same subquery above to match it on the categories.
        quiz_qz = select(question.question_id).join(question.categories).where(category.category_name.in_(filters['catz'])).where(question.created_by == UID).join(quizq, quizq.question_id == question.question_id).where(quizq.user_id == UID)
        
        #then you compare the differences between the first query and second.
        # dont work this way: res = subquery.not_in(quiz_qz)
        
        # query = subquery.filter(question.question_id.not_in(quiz_qz)) gave: nly one expression can be specified in the select list when the subquery is not introduced with EXISTS. 
   # try next  quizez = session.query(quiz_qz.question_id)
   # quizez = session.query(quiz_qz).all()
   # quizez = session.query(quiz_qz)
    # quizes = session.execute(quiz_qz).all()
        quizez_objs = session.execute(quiz_qz).scalars().all()
        
        #then you compare the differences between the first query and results of second. (qry1 - qry2 = diff)
        query = all_usr_qs_qry.filter(question.question_id.not_in(quizez_objs))
    
    # session.execute(query).all() 
        
        dif = session.execute(query).all()    
        
  
    
        personal_qs = []
        for r in dif:
            personal_qs.append(r)
    
        
        
    # result = session.execute(subquery).all()
    # question_que = []
    # for r in result:
    #     question_que.append(r)
              
              
              
    
    # first get the created_by user_id list from the filter selections by only grabbing the users that have a true value in each category seperately. One at a time! Then combine the list together.
    
     #get users specified by the filters
    user_list = []
    # fav_qry = select(users.favorates).where(users.id == UID)
    user1 = select(users).where(users.id == UID)
    user_obj = session.execute(user1).first() 
    # gather up the current user's favorate users 
    fav_list = []
    for u in user_obj:
        for f in u.favorates:
            fav_list.append(f.id)
    
      # gather up the current user's blocked users 
    block_list = []
    for u in user_obj:
        for f in u.favorates:
            block_list.append(f.id)        
    
    if filters['public'] == True:
        public_user_qry = select(users.id).where(users.id != UID).filter(users.id.not_in(fav_list)).filter(users.id.not_in(block_list))
        
        res = session.execute(public_user_qry).all()    
          
        for r in res:
            user_list.append(r)
    
    if filters['favorate'] == True:
        user_list += fav_list
       
    if filters['blocked'] == True:
         user_list += block_list           
        
        


      
    #one way to do it: get list of all public questions
    #1 within the categories
    #2 
  
   
    
  
   # select all but quiz-q stuff
    #all_qs_qry =  
 
    #works!!!
    exclusion_qry = select(question.question_id).join(question.categories).where(category.category_name.in_(filters['catz'])).join(quizq, quizq.question_id == question.question_id).where(quizq.user_id == UID)
        
    exclusion_objs = session.execute(exclusion_qry).scalars().all()
    
    
    
    
    question_que = []
    for r in qryz_objs:
        question_que.append(r)
              
    a = 'a'
    
    # users list
    
    
    
    
    
    
    # then query everything in one shot trying to do a join that excludes quiz_qs. 
    
    
   # subquery = select(question).join(question.categories).where(category.category_name.in_(selected_categories)).join(quizq, question.question_id == quizq.question_id)
    
   
   
   
   
    # execute the query
   # results = query.all()

    # MAKE THIS A FUNCTION- IT'S used by 2 methods here
    search_results = []
    # for r in results:
    #     catz = []
    #     for c in r.question.categories:
    #         catz.append(c.category_name)

    #     q = {
    #         "question_text": r.question.question_text,
    #         "question_id": r.question.question_id,
    #         "categories": catz,
    #     }
    #     search_results.append(q)

    search_response = jsonify(search_results)
    msg = "Search Completed"
    flash(msg, category="success")
    return search_response
    
   
    

       
            
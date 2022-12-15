from re import A
from typing import final
from flask import Blueprint, render_template, request, jsonify, flash, Flask
from flask import current_app as app
from flask_login import current_user, login_required, logout_user

from sqlalchemy.orm import Query, selectinload, joinedload
from sqlalchemy import select, Interval, join
from ..database import Base, engine, session
from ..models import category, question, q_pic, quizq, level
import re
from sqlalchemy.sql import func, exists
from sqlalchemy.sql.expression import bindparam
from flask_uploads import configure_uploads, IMAGES, UploadSet
from wtforms import FileField, StringField, validators
from flask_wtf import FlaskForm
from werkzeug.utils import secure_filename
# from ..s3upload import upload_file
from ..aws_s3 import *
from datetime import datetime, timedelta
import random
from flask import g
import copy


# Blueprint Configuration
home = Blueprint(
    'home', __name__,
    template_folder='templates',
    static_folder='static'
)

class MyForm(FlaskForm):
    question_image = FileField('question_image')
    hint_image = FileField('hint_image')
    
    # question2 = StringField(u'Question text', validators=[validators.input_required()])
    
    # form upload shit
images = UploadSet('images', IMAGES)
configure_uploads(app, images)

def allowed_file(filename):
    return '.' in filename and \
        filename.split('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

@home.route('/', methods=['GET', 'POST'], endpoint='homepage')
@login_required
def homepage():
    """Homepage."""
    return render_template(
        'home.html',
        title="Homepage",
        description=".",
        user=current_user,
    )

@home.route('/addcontent', methods=['GET', 'POST'], endpoint='addcontent')
@login_required
def addcontent():
    form = MyForm()
    category_list = []
    if request.method == 'GET':
        result = session.execute(select(category))
        category_list.extend(cat.category_name for cat in result.scalars())
        return render_template(
            'addcontent.html',
            title="Add content",
            description=".",
            user=current_user,
            category_list=category_list,
            form=form,
            )

    if request.method == 'POST':
        question_name = request.form.get('question_name')
        question_text = request.form.get('question_text')
        hint = request.form.get('hint')
        answer = request.form.get('answer')
        
        category_names = request.form.getlist('category_name')      

    #  TEESTING MULTIPLE IMAGE UPLOADS

    if form.validate_on_submit():
        if len(question_name) < 1 or len(question_text) < 3 or len(answer) < 1:
            return flash('shits too short bro!', category='failure')

        existing_q_name = session.execute(select(question).where(question.question_name == question_name)).first()
        existing_q_text = session.execute(select(question).where(question.question_text == question_text)).first()
        if existing_q_name is not None or existing_q_text is not None:
            return flash('question already exists!', category='failure')
        selected_categories = []
        #  if only one category is selected
        # if isinstance(category_name, str):
        #     selected_categories.extend(category_name)
        # else:
        #     selected_categories.extend(selected_cat for selected_cat in category_name)
        
     
                        

            
        # create new question!
        new_question = question(question_name=question_name,
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
        hint_image = ''
        question_image = ''
        
        # gather the pictures
        pic_types = { 'answer_pics', 'hint_image', 'question_image' }
        for pic_type in pic_types:
            if pic_type in request.files:
                pictures = request.files.getlist(pic_type)
                for pic in pictures:
                    if pic and allowed_file(pic.filename):
                        # save it to web server
                        picname = secure_filename(pic.filename)
                        pic.save(os.path.join(app.config['UPLOAD_FOLDER'], picname))
                        # upload to S3
                        file_directory = 'repz/home/static/'
                        file_name = file_directory + picname
                        Metadata = { "x-amz-meta-question" : question_name,  "x-amz-meta-pic_type" : pic_type }
                        ExtraArgs = { 'Metadata' : Metadata }
                        location_string = upload_file_to_s3(file_name, ExtraArgs, object_name=picname)
                        new_question.pics.append(q_pic( pic_string = location_string, 
                                   pic_type = pic_type ))
                                                  
        
        session.add(new_question)
        session.commit()
        flash('New question created!', category='success')
        result = session.execute(select(category))
        category_list.extend(cat.category_name for cat in result.scalars())
        return render_template(
            'addcontent.html',
            title="Add content",
            description=".",
            user=current_user,
            category_list=category_list,
            form=form,
        )
        



@home.route("/add", methods=["POST"], endpoint='add')
@login_required
def add():
    newCategory = request.form.get("add_category_field", type=str)
    # validation
    er = False
    htl = ''
    if len(newCategory) < 3:
        flash('too short bro!', category='failure')
        er = True
    else:
        query = Query([category])
        result = query.with_session(session)
        for c in result:
            if newCategory == c.category_name:
                flash('category already exists')
                er = True
    data = 'start val'
    if er == False:
        new_cat = category(
                    category_name = newCategory
                    )
        session.add(new_cat)
        session.commit()
        flash('Category created!', category='success')
        
        # clean up the string
        data = newCategory
        htl = clean_for_html(newCategory)
    else: 
        data = ''
    return jsonify(data, htl)    
    
    
def clean_for_html(unclean:str) -> str:
    unclean = re.sub(r"[^\w\s]", '', unclean)
    # Replace all runs of whitespace with a single dash
    clean = re.sub(r"\s+", '_', unclean)
    return clean.lower()    
    
#Get list of categories
# def get_cat_list():
#     category_list = []
#     result = session.execute(select(category))
#     for cat in result.scalars():
#         cat_name = clean_for_html(cat.category_name)
#         category_list.append(cat_name)
#     category_list = category_list.sort()
#     return category_list


@home.route("/quiz", methods=["GET", "POST"], endpoint='quiz')
@login_required
def quiz():
    # Redundant 
    # user_id_no = current_user.get_id()
    # UIDa = current_user.id
    UID1 = g._login_user.id
    
    UID = copy.copy(UID1)
    
    # question lookup
    
    if request.method == 'GET':
    #Uncomment/CHANGE THIS TO POST WHEN READY!
    #if request.method == 'POST':
        #selected_cats = request.form.getlist('category_name')
        selected_cats = ['pooping']
        
        cats_query = select(category).where(category.category_name in selected_cats)
        selected_categories = session.execute(cats_query)
               
        question_q = que_overdue_questions(UID, selected_categories)
        
        #  get a random question from that list to display
        current_question = randomizifier(question_q)
        
        question_scalar = session.execute(select(quizq).where(quizq.quizq_id == current_question.quizq_id)).scalar()
        
              #join Level to quizQ
    # joined_question = select(level).join(quizq, level.level_no == q.level_no)
    # quizq_with_level = session.execute(joined_question).scalar()
       
        
        return render_template(
            'quiz.html',
            title="Quiz",
            description=".",
            user=current_user,
            category_list=category_list,
            current_question = current_question
            # form=form,
            )
                  
def que_overdue_questions(UID, selected_categories):
    question_q = []
    current_time = func.now(),
    
    now = datetime.now()

    two_hours_ago = now - timedelta(hours=2)

# return all users created less then 2 hours ago
# db.query(User).filter(User.created_on > two_hours_ago).all()
#     fn = 
    
    # questions = select(quizq).join(level).where(    )
    
    # didnt work q_query = select(quizq).join(level.level_no)
    # result = q_query.with_session(session) stmt = select(User).join(Address, User.id == Address.user_id)
    
#  worked i think but not with for loop  stmt = select(quizq).exists()
    
#     query = Query([stmt])


    # subq_not_null_quizq = select(quizq).where(quizq.answered_on == None).subquery()
    
    # stmt = select(question).join(subq_not_null_quizq, question.question_id == subq_not_null_quizq.c.question_id)
        
    # quest_wCats_qry = select(question).options(selectinload(question.categories)).where(question.categories in selected_categories).subquery()
        
    quest_wCats_qry = select(question).options(joinedload(question.categories)).where(question.categories in selected_categories).subquery()   
        
    joined_qz_qu_cat = select(quizq).join(quest_wCats_qry, quizq.question_id == quest_wCats_qry.c.question_id)     
        
        
    # final_result = session.execute(joined_qz_qu_cat)    
        
        #test the above
    rp = []
    for obj in session.execute(joined_qz_qu_cat):
        print(obj)
        p = rp.append(r)
        
    final_result = session.execute(joined_qz_qu_cat)
    rwz = []
    for r in final_result:
        p = rwz.append(r)
        qid = r.question.question_id
                
        
    ddd = []
    quest_wCats_qry = select(question).options(selectinload(question.categories)).where(question.categories in selected_categories)
    #USELESS- JUST FOR TESTING PURPOSES act
    # for row in session.execute(quest_wCats_qry):
    #     for a in row.question.categories:
    #         dickwed = a.category_name 
    #         CATNAME_YO = ddd.append(a.category_name)
            
    qus_wCats = session.execute(quest_wCats_qry)
            
    joined_qz_qu_cat = select(quizq).join(qus_wCats, quizq.question_id == qus_wCats.question.question_id)        
          
        # test if there are any in existance
    query = Query([quizq]).filter(quizq.answered_on == 'NULL')
    unanswered_quizes = query.with_session(session).all()
    question_q = []
    if unanswered_quizes is not None:
               #join question to quizQ
        joined_question = select(level).join(quizq, level.level_no == q.level_no)
        quizq_with_level = session.execute(joined_question).scalar()
        
        
        
        #USELESS
        q_query = (            
            select(quizq).where(quizq.level_no == level.level_no)
        )
        result = session.execute(q_query).scalars()
        
        if result != 'None':
            for q in result:
                to_que = que_determination(quizq)
                if to_que:
                    question_q.append(q)
        
    
    # if exists_criteria:
    #     q_query = select(quizq).join(level, quizq.level_no == level.level_no)
        
    #     result = session.execute(q_query).exists()
    
    # didnt work q_query = select(quizq).join(quizq.level_no).join(quizq.question_id)
    
    # result = session.execute(q_query)
        # if not result:
        #     penis = 1
        # else:
        #     for r in result:
        #         question_q.append(r)
    # stmt = select(User).join(User.orders).join(Order.items)
    
    if len(question_q) < 1:
        additional_questions = new_q_lookup(UID, selected_categories)
        question_q.extend(q for q in additional_questions)
        
        # make a list of all the top Level questions due to run then
    return question_q


def que_determination(quizq) -> bool:

    # see which questions are actualy due by mathing levels and todays datetime
    if quizq.level_no == 0:
        return True
    # days_henc = quizq_with_level.days_hence
   # if ((quizq_with_level.days_hence + 


            # looks up all questions with an assigned Level ONLY. Sorted Decending (highest level first)
def new_q_lookup(UID, selected_categories):
    subquery = select(question).join(quizq, question.question_id == quizq.question_id)
    subq = session.execute(subquery)
    new_q_query = select(question).where(question.question_id not in subq).limit(5)
    new_questions = session.execute(new_q_query).scalars()
    

    
    new_q_quiz_list = []
    for new_question in new_questions:
        new_quizq = quizq(
            user_id = UID,
            level_no = 1,        
        )
        penis = new_question.question_id
         #'NoneType' object has no attribute 'append' new_quizq.question_id.append(new_ques.question_id)
        new_quizq.question_id = new_question.question_id
        # new_q_quiz_list.append(new_quizq)
        session.add(new_quizq)
        session.commit()
   
     #grab the list now that it's created
    new_quiz_q_query = select(quizq).where(quizq.question_id in new_questions)
    new_q_quiz_scalars = session.execute(new_quiz_q_query).scalars()
    for new_quiz in new_q_quiz_scalars:
        new_q_quiz_list.append(new_quiz)
          
    return new_q_quiz_list


def randomizifier(question_q):
    if question_q is not None:
        if isinstance(question_q, list):
            rand_q = copy.copy(random.choice(question_q)) #Crashed here. FIX THIS NEXT
        else:
            rand_q = copy.copy(question_q)
        
        # no worked
        # quizq_query = select(quizq).where(quizq = rand_q)
        # random_quizq = session.execute(quizq_query).scalars()  
        
        # random_quizq = session.execute(rand_q).scalars()  
         
       
        return rand_q
    else:
        return None
    

#lookup all questions that are NOT IN quizqa first, so you can instantiate them as level 0 quizq rows.
    # for r in result:
    #     added_questions.append(r)    # for s in subq:
    #     added_questions.append(s)
        # loop thru all the questions and make a que list for the user so view can display their titles in sidebar
    # do a query in db to see what question is next. You need to see what questions the user has created in question table and cross reference created_on column to see if it's been 24hrs since then and to then set that question to Level #1
    # added_questions = []
    
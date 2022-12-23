from re import A
from typing import final
from flask import Blueprint, render_template, request, jsonify, flash, Flask
from flask import current_app as app
from flask_login import current_user, login_required, logout_user

from sqlalchemy.orm import Query, selectinload, joinedload, aliased, subqueryload, with_parent, contains_eager
from sqlalchemy import select, Interval, join, intersect
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
    
    
  
    
    
    
    # question lookup  null_quizq = select(quizq).join(quest_wCats_qry, quizq.question_id == quest_wCats_qry.c.question_id).where(quizq.answered_on == None).subquery()
    
    # if request.method == 'GET':
    
    #Uncomment/CHANGE THIS TO POST WHEN READY!
    #if request.method == 'POST':
        #selected_cats = request.form.getlist('category_name')
    selected_cats = ['pooping']
        
        # get selected categories as a sqlalchemy object (not sure if necessary)
    # cats_query = select(category).where(category.category_name.in_(selected_cats))
    # selected_categories = session.execute(cats_query).scalars().all()
        
    # # pp = (p.category_name for p in selected_categories) # returns weird generator object
    # cat_list = []
    # for s in selected_categories:
    #     a = cat_list.append(s.category_name)
        
            
    null_quizq = select(quizq).where(quizq.answered_on == None).where(quizq.user_id == UID).subquery()
     
    quest_wCats_qry = select(question, category, quizq, level.days_hence).join(question.categories).where(category.category_name.in_(selected_cats)).join(null_quizq, question.question_id == null_quizq.c.question_id).join(level, null_quizq.c.level_no == level.level_no)
    
   
    
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
            catz = []
            pics = []
            c2 = []
            # didnt quite work
            # catz.append(c.category_name for c in r.question.categories)
            # catz.append(c.category_name for c in r.category)
            for c in r.question.categories:
                catz.append(c.category_name)
                for qu in c.questions:
                    if qu.question_id == r.question.question_id:
                        for cc in qu.categories:
                            c2.append(cc.category_name)       
                            #c.questions[0].categories[0].category_name
            # adding array to dict i think?? d = {k:[] for k in ['A', 'B', 'C']}
            imgz = {k:[] for k in ['answer_pics', 'hint_image', 'question_image']}
            # imgz = {}    
            for img in r.question.pics:
                imgz[img.pic_type].append(img.pic_string)
                
                
                pics.append(img.pic_type)
                pics[img.pic_type].append(img.pic_string)
                
                #for x, y in thisdict.items(): ONE WAY TO DO IT
                
                # pics.append(img.pic_type)
                # pic_typ = img.pic_type
                # pics.pic_typ.append(img.pic_string)
           
            q = { 'question_id': r.question.question_id,
                  'question_name' : r.question.question_name,
                  'hint' : r.question.hint,
                  'answer' : r.question.answer,
                 
                'level_no' : r.quizq.level_no,
                'categories' : catz,
                'pic' : 'do it later'             
                }          
            que_list.append(q)
             
        result_list.append(r)    
        
        # INSTRUCTIONS:
        #  NEXT: MERGE QUESTION OBJECT WITH: you'll need to grab the q_pics which are linked to Question table.
        # Need to do another query on quizq to get 2 criteria: 
        # 1. same user AND 2. answered_on (OR Correct) = NULL
        # # NEXT: You'll need to grab the LEVEL_NO which are linked to quiz_q table.
        # FINALLY: You'll need to somehow join or merge the questions_id query with quiz_q query outlined above to present to the user the appropriate quizQ object. OR Just merge them along each step of the way (hard probably). Most likely use sub-queries i guess?
        # ALTERNATIVELY: You can grab level & q_pics later.
    
    # for r in result.scalars():# list' object has no attribute 'scalars
       
    
    p = 'penis'
  
    
    question_q = que_overdue_questions(UID, cat_list)
        
     
     
        #  get a random question from that list to display
    # current_question = randomizifier(question_q)
        
    # question_scalar = session.execute(select(quizq).where(quizq.quizq_id == current_question.quizq_id)).scalar()
        
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
    
    
    # NEED TO GRAB ALL QUIZQ THAT 1. quizq.answered_on (OR correct) = NULL  AND 2. Are in the selected Categories. THAT"S IT!
    
#     # TESTING SUBQUERY-LOAD WORKED- BUT IT'S LEGACY SHIT GIVING UP ON IT!
#     # subquery-load the orders= "CATEGORIES" collection on User="QuESTION"
#     qry = Query.with_entities(question).options(subqueryload(question.categories))
    #     result = qry.with_session(session)
#     ary = []
#     for r in result:
#         d = ary.append(r)
# # subquery-load Order.items and then Item.keywords
#     qry_b = Query(question).options(subqueryload(question.quizqs).subqueryload(question.categories))
    #     result_b = qry_b.with_session(session).scalars()
#     ary_b = []
#     for rb in result_b:
#         d = ary.append(rb)
    
    
    # testing 2.0 style where AND .any clauses AND .all() apparently
   # qlalchemy.exc.InvalidRequestError: Can't compare a collection to an object or collection; use contains() to test for membership.
    # stmt = select(question.question_id).where(question.categories.any(question.categories == selected_categories))

    #sqlalchemy.exc.ArgumentError: Mapped instance expected for relationship comparison to object.   Classes, queries and other SQL elements are not accepted in this context; for comparison with a subquery, use question.categories.has(**criteria).
    # same error with the list of cats
    # stmt = select(question.question_id).where(question.categories.any(question.categories.contains(selected_categories)))
    
    #sqlalchemy.exc.InvalidRequestError: 'has()' not implemented for collections.  Use any().
    # failed on both cat list types
    # stmt = select(question.question_id).where(question.categories.any(question.categories.has(selected_categories)))
    
    #AttributeError: 'list' object has no attribute '_annotate' (failed for both types)
    # stmt = select(question.question_id).where(question.categories.any(selected_categories))
    
    # qlalchemy.exc.ArgumentError: Mapped instance expected for relationship comparison to object.   Classes, queries and other SQL elements are not accepted in this context; for comparison with a subquery, use question.categories.has(**criteria).
    # query = select(question.question_id).where(question.categories.contains(selected_categories))
    #      also same error: 
    #              query = select(question.question_id).where(question.categories.contains(c for c in selected_categories))
         
    # query = select(question.question_id).where(question.categories.contains(c for c in selected_categories))     
    
    
    query = session.query(question.question_id).filter(question.categories.contains(['pooping', 'pissing']))
    
#     q = aliased(question)
#     query = select(q).where(
#     with_parent(q, question.categories.of_type(a2))
# )
    
    
    
    
         
    result_d = session.execute(query).all()
    
    
    ary_c = []
    for r in result_d:
        d = ary_c.append(r)

#     Original code
#     stmt = select(User.fullname).where(
# ...     User.addresses.any(Address.email_address == "squirrel@squirrelpower.org")
# ... )
# >>> session.execute(stmt).all()
    
    
    
    p = 'penis'
# lazily load Order.items, but when Items are loaded,
# subquery-load the keywords collection
# query(Order).options(
#     lazyload(Order.items).subqueryload(Item.keywords))

    
    # ORIGINAL CODE:    
    # subquery-load the "orders" collection on "User"
# query(User).options(subqueryload(User.orders))

# # subquery-load Order.items and then Item.keywords
# query(Order).options(
#     subqueryload(Order.items).subqueryload(Item.keywords))

# # lazily load Order.items, but when Items are loaded,
# # subquery-load the keywords collection
# query(Order).options(
#     lazyload(Order.items).subqueryload(Item.keywords))
    
    
    
    

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
        #qlalchemy.exc.InvalidRequestError: Can't compare a collection to an object or collection; use contains() to test for membership. 
    # quest_wCats_qry = select(question).options(joinedload(question.categories)).where(question.categories in selected_categories).subquery()   
    
    
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
    
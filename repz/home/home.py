from re import A
from typing import final
from flask import Blueprint, render_template, request, jsonify, flash
from flask import current_app as app
from flask_login import current_user, login_required, logout_user

from sqlalchemy.orm import Query
from sqlalchemy import select
from ..database import Base, engine, session
from ..models import category, question
import re
from sqlalchemy.sql import func
from werkzeug import secure_filename
from flask_uploads import configure_uploads, IMAGES, UploadSet
from wtforms import FileField
from flask_wtf import FlaskForm


# Blueprint Configuration
home = Blueprint(
    'home', __name__,
    template_folder='templates',
    static_folder='static'
)

class MyForm(FlaskForm):
    image = FileField('image')


@home.route('/', methods=['GET', 'POST'], endpoint='homepage')
@login_required
def homepage():
    """Homepage."""
    return render_template(
        'home.html',
        title="Homepage",
        description=".",
        user=current_user
    )

@home.route('/addcontent', methods=['GET', 'POST'], endpoint='addcontent')
@login_required
def addcontent():
    if request.method == 'GET':
        # category_list = get_cat_list()
        category_list = []
        # html_category_list = []
        result = session.execute(select(category))
        category_list.extend(cat.category_name for cat in result.scalars())
        return render_template(
            'addcontent.html',
            title="Add content",
            description=".",
            user=current_user,
            category_list=category_list,
            )

    if request.method == 'POST':
        question_name = request.form.get('question_name')
        question_text = request.form.get('question_text')
        hint = request.form.get('hint')
        
        category_name = request.form.get('category_name')
        butthole = request.form.get('anus_checkbox_name')
        
    # form upload shit
        images = UploadSet('images', IMAGES)
        configure_uploads(app, images)

    form = MyForm()

    if form.validate_on_submit():
        
        filename = images.save(form.image.data)
        return f'Filename: { filename }'
            #  form upload shit
        
        answer = request.form['answer']
        # validation  
        if len(question_name) < 1 or len(question_text) < 3 or len(answer) < 1:
            return flash('shits too short bro!', category='failure')

        existing_q_name = session.execute(select(question).where(question.question_name == question_name)).first()
        existing_q_text = session.execute(select(question).where(question.question_text == question_text)).first()
        if existing_q_name is not None or existing_q_text is not None:
            return flash('question already exists!', category='failure')
        print('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
           
        # create new question!
        # new_question = question(question_name=question_name,
        #                         question_text=question_text,
        #                         hint=hint,
        #                         created_on=func.now(),
        #                         answer=answer,
        #                         categories=category_name,
        #                         # created_by= current_user.id,
        #                         )
        # session.add(new_question)
        # session.commit()
        flash('New question created!', category='success')
        return render_template(
            'addcontent.html',
            title="Add content",
            description=".",
            user=current_user,
            category_list='dildo'
        )
        



@home.route("/add", methods=["POST"], endpoint='add')
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


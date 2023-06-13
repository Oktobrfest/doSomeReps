from flask import Blueprint, redirect, render_template, flash, request, session, url_for, jsonify
from flask_login import login_required, logout_user, current_user, login_user
from flask import current_app as app
from ..models import users
from ..bluehelpers import *
import json

from ..database import *
from ..models import *
from repz.routes import *
from ..bluehelpers import *

# Blueprint Configuration
ajax = Blueprint("ajax", __name__)


# adds a new category
@ajax.route("/add", methods=["POST"], endpoint="add")
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



#save question changes within edit questions page
@ajax.route("/saveq", methods=["POST"], endpoint="saveq")
@login_required
def saveq():
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












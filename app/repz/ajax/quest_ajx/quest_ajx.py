from flask import flash, request, session, jsonify
from flask_login import login_required
from flask import g, make_response
from ...models import q_pic, users, question, quizq, category, rating
import json


import copy
from repz import cache
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload, Query

from ...database import session
from repz.routes import quest_ajx
from ...bluehelpers import clean_for_html, get_all_db_categories, get_user, remove_underscore, set_session, delete_pic
from ...home.form_helpers import save_pictures


# adds a new category
@quest_ajx.route("/addcat", methods=["POST"], endpoint="addcat")
@login_required
def addcat():
    newCategory = request.form.get("add_category_field", type=str)

    # validation
    er = False
    htl = ""
    data = ""
    try:
        if len(newCategory) < 3:
            data = "too short bro!"
            flash(data, category="error")
            er = True
        else:
            query = Query([category])
            result = query.with_session(session)
            for c in result:
                if newCategory == c.category_name:
                    data = "category already exists"
                    flash(data)
                    er = True

        if not er:
            new_cat = category(category_name=newCategory)
            session.add(new_cat)
            session.commit()
            flash("Category created!", category="success")
            category_list = get_all_db_categories()
            cache.set('category_list', category_list, timeout=60*60*24) # a day
            # clean up the string
            data = newCategory
            htl = clean_for_html(newCategory)
        else:
            htl = "error"
            print("Error occured while trying to create a new category! ",
                  data)
        return jsonify({'data': data, 'htl': htl})

    except Exception as e:
        print("Error occured creating a new category! ", data)
        return jsonify({'data': 'error', 'htl': data + str(e), 'error':
            True}), 500


#save question changes within edit questions page
@quest_ajx.route("/saveq", methods=["POST"], endpoint="saveq")
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
    
    session.query(question).filter(question.question_id == updated_question['id']).update(
        {
            "question_text": updated_question['question_text'],
            "hint": updated_question['hint'],
            "answer": updated_question['answer'],
            "privacy": privacy,
        },
        synchronize_session='fetch',
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


# not quemore search button
@quest_ajx.route("/searchq", methods=["POST"], endpoint="searchq")
@login_required
def searchq():
    UID = g._login_user.id
    # get The submitted Json values
    filters = request.get_json()
        
    underscored_cats = filters["search-categories"]
    
    set_session("filter_categories", underscored_cats)


    filter_cats = list(map(lambda x: remove_underscore(x), underscored_cats))

    excluded_chkbox = filters['excluded-filter-checkbox']

    # query db
    # list of column names to search
    column_names = filters["search-within"]
    # equest.json['search-within'] #['column1', 'column2', 'column3']

    # the value to search for
    search_value = filters["search-terms"]

    # build the query
    query = (
        session.query(question).distinct(question.question_id)
        .join(question.categories)
        .filter(category.category_name.in_(filter_cats))
        .filter(question.created_by==UID)
    )
    
  # get the user obj
    user = get_user(UID)

    excluded_question_ids = [q.question_id for q in user.excluded_questions]
    if excluded_chkbox == False:
        # update query to exclude them
        query = query.filter(~question.question_id.in_(excluded_question_ids))
    else:
        query = query.filter(question.question_id.in_(excluded_question_ids))

    for column_name in column_names:
        query = query.filter(or_(getattr(question, column_name).contains(search_value)))

    # execute the query
    results = query.all()

    search_results = []
    for r in results:
        catz = []
        for c in r.categories:
            catz.append(c.category_name)

        q = {
            "question_text": r.question_text,
            "question_id": r.question_id,
            "categories": catz,
        }
        search_results.append(q)

    search_response = jsonify(search_results)
    return search_response


@quest_ajx.route("/getq", methods=["POST"], endpoint="getq")
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


@quest_ajx.route("/deleteq", methods=["POST"], endpoint="deleteq")
@login_required
def deleteq():
    delete_q = request.get_json()
    question_id = delete_q["id"]
    
    q = session.query(question).options(joinedload(question.pics)).filter_by(question_id=delete_q["id"]).first()

    # gather the q_pics and remove them from s3
    q_pics = q.pics

    # loop over the q_pics and delete their corresponding objects in S3
    for pic in q_pics:
        delete_pic(pic)
    
    exquestion = session.query(question).filter(question.question_id == question_id).first()
    # find all entries in 'excluded_questions' where 'question_id' matches the question you want to delete
    if exquestion is not None: 
        q_users = session.query(users).filter(users.excluded_questions.contains(exquestion)).all()

        for usr in q_users:
            usr.excluded_questions.remove(exquestion)
    
    session.delete(q)
    session.commit()
    msg = "Question Deleted"
    flash(msg, category="success")
    return msg


@quest_ajx.route("/rateq", methods=["POST"], endpoint="rateq")
@login_required
def rateq():
    data = request.get_json()
    quizq_id = data['quizq_id']
    rated = data['rating']
    UID = g._login_user.id

    question_id_qry = select(quizq.question_id).where(quizq.quizq_id == quizq_id)
    question_id = session.execute(question_id_qry).scalar()

    existing_rating = session.query(rating).filter(rating.question_id == question_id, rating.user_id == UID).first()

    if existing_rating is None:
        # create new rating entry
        new_rating = rating(question_id = question_id,
                        user_id = UID,
                        rating = rated,)
        
        session.add(new_rating)
        session.commit()
        msg = "Question Rated"
    else:
        existing_rating.rating = rated
        msg = "Question Rating Updated"

    flash(msg, category="success")
    return msg


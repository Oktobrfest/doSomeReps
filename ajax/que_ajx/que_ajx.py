from flask import Blueprint, redirect, render_template, flash, request, session, url_for, jsonify
from flask_login import login_required, logout_user, current_user, login_user
from flask import current_app as app
from ...models import users
from ...bluehelpers import *
import json

from ...database import *
from ...models import *
from repz.routes import *
from ...bluehelpers import *


# Blueprint Configuration
que_ajx = Blueprint("que_ajx", __name__)

                        
            # In the quemore page
@que_ajx.route("/searchquefilters", methods=["POST"], endpoint="searchquefilters")
@login_required
def searchquefilters():
    UID = g._login_user.id
    filters = request.get_json()
    cleaned_cats = list(map(lambda x: remove_underscore(x), filters['catz']))
    filters['catz'] = cleaned_cats

    set_session("search_que_filters", filters)

    cur_user = get_user(UID)  
    excluded_question_ids = [q.question_id for q in cur_user.excluded_questions]

    question_que = []
    if filters['personal'] == True:
        # first grab all that users questions within the categories selected
        all_usr_qs_qry = select(question).join(question.categories).where(category.category_name.in_(filters['catz'])).where(question.created_by == UID)
        
        # then grab all the quiz_qs for that user. You can use the same subquery above to match it on the categories.
        quiz_qz = select(question.question_id).join(question.categories).where(category.category_name.in_(filters['catz'])).where(question.created_by == UID).join(quizq, quizq.question_id == question.question_id).where(quizq.user_id == UID)
        
        quizez_objs = session.execute(quiz_qz.distinct()).scalars().all()
        
        #then you compare the differences between the first query and results of second. (qry1 - qry2 = diff)
        query = all_usr_qs_qry.filter(question.question_id.not_in(quizez_objs))

        if filters['excluded'] == False:
            query = query.filter(~question.question_id.in_(excluded_question_ids))
    
        dif = session.execute(query.distinct()).scalars().all()    
      
        for r in dif:
            question_que.append(r)
    
     #get users specified by the filters
    user_list = []
    # fav_qry = select(users.favorates).where(users.id == UID)
    user1 = select(users).where(users.id == UID)
    user_obj = session.execute(user1).first() 
    # gather up the current user's favorate users 
    fav_list = []
    block_list = []
    for user in user_obj:
        for f in user.favorates:
            fav_list.append(f.id)
        for b in user.blocked_users:
            block_list.append(b.id)        
    
    if filters['public'] == True:
        public_user_qry = select(users.id).where(users.id != UID).filter(users.id.not_in(fav_list)).filter(users.id.not_in(block_list))
        
        res = session.execute(public_user_qry).all()    
          
        for r in res:
            user_list.append(r[0])
    
    if filters['favorate'] == True:
        user_list += fav_list
       
    if filters['blocked'] == True:
        user_list += block_list   

    # all questions list    
    filtered_users_qs_qry = select(question).join(question.categories).where(category.category_name.in_(filters['catz'])).where(question.created_by.in_(user_list)).where(question.privacy == False)

    # questions to exclude from all questions list(filtered_users_qs_qry)
    exclusion_qry = select(question.question_id).join(question.categories).where(category.category_name.in_(filters['catz'])).join(quizq, quizq.question_id == question.question_id).where(quizq.user_id == UID)

        
    exclusion_objs = session.execute(exclusion_qry.distinct()).scalars().all()
    # not needed! exclusion_tuple = tuple([ x for x in exclusion_objs ])
    
    # all questions list - exclusion_qry = final_query
    final_query = filtered_users_qs_qry.filter(question.question_id.not_in(exclusion_objs))

     #excluded questions omited from all quesitons list            
    if filters['excluded'] == False:
        # update query to exclude them
         final_query = final_query.filter(~question.question_id.in_(excluded_question_ids))
      
    filtered_questions = session.execute(final_query.distinct()).scalars().all()    
        
    for r in filtered_questions:
        question_que.append(r)
     
    search_results = []          
    for r in question_que:
        catz = []
        for c in r.categories:
            catz.append(c.category_name)

        # get username
        usr_qry = select(users.username).where(users.id == r.created_by)
        username = session.execute(usr_qry).scalar()
        
        # see if user is a favorate
        fav_qry = select(users).where(users.id == UID)
        user = session.execute(fav_qry).scalars().first()
        fav = False
        for u in user.favorates:
                if u.id == r.created_by:
                    fav = True    
        
        # get rating
        rate_qry = select(rating.rating).where(rating.question_id == r.question_id)
        rates = session.execute(rate_qry).scalars().all()
        rating_total = [ x for x in rates ]
        if len(rating_total) == 0:
            rate = 0
        else:
            rate = sum(rating_total) / len(rating_total)
        
        # see if in excluded list
        if filters['excluded'] == False:
            excluded = False
        else:
            if r.question_id in excluded_question_ids:
                 excluded = True
            else:
                excluded = False

        q = {
            "question_text": r.question_text,
            "question_id": r.question_id,
            "categories": catz,
            "username": username,
            "created_by": r.created_by,
            "favorite": fav,
            "rating": rate,
            "excluded": excluded,
        }
        search_results.append(q)
    # add selected categories to the session
   #   set_session("quiz_category_names", filters['catz'])
        
    search_response = jsonify(search_results)
    msg = "Search Completed"
    flash(msg, category="success")
    return search_response


@que_ajx.route("/save_to_que", methods=["POST"], endpoint="save_to_que")
@login_required
def save_to_que():
    UID = g._login_user.id
    
    data = request.get_json()
    que = data.get("que", [])
    exclusion_ids = data.get("exclude", [])
    unexclude_ids = data.get("unexclude", [])
    msg = ""

    if len(que) > 0:
        qty_added = new_quizq(que, UID)  
        msg = "Saved " + str(qty_added) + " questions to your que. "
    else:
        qty_added = 0
    
    if len(exclusion_ids) > 0:
        exclude_count = exclude(exclusion_ids, UID)
        msg = msg + "Excluded " + str(exclude_count) + " questions. " 
    
    if len(unexclude_ids) > 0:
        unexclude_count = 0
        for unx_id in unexclude_ids:
            res_msg = unexclude(unx_id, UID)
            if 'success' in res_msg:
                unexclude_count += 1
        msg = msg + "Un-Excluded " + str(unexclude_count) + ' questions.'
    flash(msg, category="success")
    
    response_msg = jsonify('ok')
    
    return response_msg          


@que_ajx.route("/unexclude_q", methods=["POST"], endpoint="unexclude_q")
@login_required
def unexclude_q():
    UID = g._login_user.id

    question_id = request.get_json()

    enexclude_result = unexclude(question_id, UID)
    
    if 'success' in enexclude_result:
        flash(enexclude_result['success'], category="success")
    else:
        flash(enexclude_result['failure'], category="failure")
        # impliment logging in future #todo
    
    response_msg = jsonify('ok')
    
    return response_msg





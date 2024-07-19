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
from ..ajax_response import AjaxResponse


# Blueprint Configuration
que_ajx = Blueprint("que_ajx", __name__)

                        
            # In the quemore page
@que_ajx.route("/searchquefilters", methods=["POST"], endpoint="searchquefilters")
@login_required
def searchquefilters():
    UID = g._login_user.id
    filters = request.get_json()
    
    response = AjaxResponse()
    
    if len(filters['catz']) < 1:
        # FAILED VALIDATION'
        response.msg = "You didn't select any question categories! Try again."
        response.msg_category = 'error'
        response.status = 'nogo'        
        return response.create_response()
    
    cleaned_cats = list(map(lambda x: remove_underscore(x), filters['catz']))
    filters['catz'] = cleaned_cats

    set_session("search_que_filters", filters)

    cur_user = get_user(UID)  
    excluded_question_ids = [q.question_id for q in cur_user.excluded_questions]
    # Start the timer (to time excecution speed for development)
    start_time = time.time()
        
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
            
            # Calculate the elapsed time of function excecution for Development ONLY
    elapsed_time = time.time() - start_time
    print("personal Elapsed time:", elapsed_time, "seconds")   
    
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
    
    elapsed_time = time.time() - elapsed_time - start_time
    print("public Elapsed time:", elapsed_time, "seconds") 
    
    if filters['favorate'] == True:
        user_list += fav_list
       
    if filters['blocked'] == True:
        user_list += block_list   

    # all questions list    
    filtered_users_qs_qry = select(question).join(question.categories).where(category.category_name.in_(filters['catz'])).where(question.created_by.in_(user_list)).where(question.privacy == False)

    # questions to exclude from all questions list(filtered_users_qs_qry)
    exclusion_qry = select(question.question_id).join(question.categories).where(category.category_name.in_(filters['catz'])).join(quizq, quizq.question_id == question.question_id).where(quizq.user_id == UID)

    elapstime = time.time()
     
    exclusion_objs = session.execute(exclusion_qry.distinct()).scalars().all()
    elapsed_time = time.time() - elapstime
    print("exclusion_objs (line 102) runtime:", elapsed_time, "seconds")        
    # not needed! exclusion_tuple = tuple([ x for x in exclusion_objs ])
    
    # all questions list - exclusion_qry = final_query
    final_query = filtered_users_qs_qry.filter(question.question_id.not_in(exclusion_objs))

    #  #excluded questions omited from all quesitons list            
    if filters['excluded'] == False:
        # update query to exclude them
        final_query = final_query.filter(~question.question_id.in_(excluded_question_ids))

    sst = time.time()


    filtered_questions = session.execute(final_query.distinct()).scalars().all()    
    # filtered_questions = session.execute(final_query.distinct()).scalars().all()    
    
    elapsed_time = time.time() - sst
    print("line 116 filtered_questions.all(): ", elapsed_time, "seconds")      
        
    for r in filtered_questions:
        question_que.append(r)
     
    s_tim = time.time() 
    fav_user_runtime = 0.0
    rating_runtime = 0.0

    search_results = []          
    for r in question_que:
        catz = []
        for c in r.categories:
            catz.append(c.category_name)

        # get username
        usr_qry = select(users.username).where(users.id == r.created_by)
        username = session.execute(usr_qry).scalar()
        
        fav_user_start_time = time.time()
        # see if user is a favorate
        fav_qry = select(users).where(users.id == UID)
        user = session.execute(fav_qry).scalars().first()
        fav = False
        for u in user.favorates:
                if u.id == r.created_by:
                    fav = True    
        fav_user_single_runtime = time.time() - fav_user_start_time
        fav_user_runtime = fav_user_runtime + fav_user_single_runtime

        st_time = time.time()
        # get rating
        rate_qry = select(rating.rating).where(rating.question_id == r.question_id)
        rates = session.execute(rate_qry).scalars().all()    
        
        el_time = time.time() - st_time
        rating_runtime = rating_runtime + el_time
        
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

    e_time = time.time() - s_tim
    print("append loop run duration: ", e_time, " seconds")
    print("total favorite user runtimes:", fav_user_runtime, " seconds")
    print("total rating runtimes:", rating_runtime, " seconds")

    response.msg = "Search Completed"
    if len(search_results) > 0:
        response.data = search_results    
    else:
        response.msg += " No Questions Found. Try selecting more categories you're interested in."
        response.msg_category = 'warning'
        response.status = 'nogo'
    return response.create_response()


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
    
    response = AjaxResponse()
    if msg == '':
        msg = 'Nothing Saved.'
        response.msg_category = 'warning'

    response.msg = msg
    response.status = 'ok'
    
    return response.create_response()          


@que_ajx.route("/unexclude_q", methods=["POST"], endpoint="unexclude_q")
@login_required
def unexclude_q():
    UID = g._login_user.id

    question_id = request.get_json()

    enexclude_result = unexclude(question_id, UID)
    
    if 'success' in enexclude_result:
        flash(enexclude_result['success'], category="success")
    else:
        flash(enexclude_result['failure'], category="error")
        # impliment logging in future #todo
    
    response_msg = jsonify('ok')
    
    return response_msg





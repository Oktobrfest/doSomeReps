from flask import g, flash, request, session, jsonify
from flask_login import login_required
from ...models import users, question, category, quizq, rating
import json

from ...database import session
from repz.routes import que_ajx
from ...bluehelpers import (exclude, create_brand_new_quizq, remove_underscore,
                            get_user, time, unexclude, get_rating)
from ..ajax_response import AjaxResponse
from repz.services.question_service import question_payload

from sqlalchemy import select
from sqlalchemy.orm import selectinload

# A search answers with each question whole, so these come in one query apiece.
WITH_CONTENT = (selectinload(question.categories), selectinload(question.pics))


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

    cur_user = get_user(UID)
    excluded_question_ids = [q.question_id for q in cur_user.excluded_questions]

    # Keyed by question_id, because the personal and the public queries below
    # are independent and can both answer with the same question.
    question_que = {}
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

        dif = session.execute(query.distinct().options(*WITH_CONTENT)).scalars().all()

        for r in dif:
            question_que.setdefault(r.question_id, r)

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

    # all questions list - exclusion_qry = final_query
    final_query = filtered_users_qs_qry.filter(question.question_id.not_in(exclusion_objs))

    #  #excluded questions omited from all quesitons list
    if filters['excluded'] == False:
        # update query to exclude them
        final_query = final_query.filter(~question.question_id.in_(excluded_question_ids))

    filtered_questions = session.execute(final_query.distinct().options(*WITH_CONTENT)).scalars().all()

    for r in filtered_questions:
        question_que.setdefault(r.question_id, r)

    authors = {r.created_by for r in question_que.values()}
    usernames = dict(session.execute(
        select(users.id, users.username).where(users.id.in_(authors))
    ).all())

    search_results = [
        {
            **question_payload(r),
            "username": usernames[r.created_by],
            "created_by": r.created_by,
            "favorite": r.created_by in fav_list,
            "rating": get_rating(r.question_id),
            # Only reported when the reader asked to see their excluded questions.
            "excluded": filters['excluded'] and r.question_id in excluded_question_ids,
        }
        for r in question_que.values()
    ]
    # add selected categories to the session
   #   set_session("quiz_category_names", filters['catz'])


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
        qty_added = create_brand_new_quizq(que, UID)
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

    unexclude_result = unexclude(question_id, UID)

    if 'success' in unexclude_result:
        return jsonify({"status": "ok", "msg": unexclude_result['success']})

    return jsonify({"status": "error", "msg": unexclude_result['failure']}), 400

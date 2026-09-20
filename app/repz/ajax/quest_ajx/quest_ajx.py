import json

import copy

from flask import flash, request, jsonify, current_app
from flask_login import current_user, login_required
from flask import g, make_response
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload

from repz.s3_ext import get_s3
from ...models import q_pic, users, question, quizq, category, rating, audio, flag, FlagCategory
from repz.extensions import cache
from ...database import session
from repz.routes import quest_ajx
from repz.services.quiz_service import invalidate_quiz_queue_cache
from ...bluehelpers import (delete_pic, flag_payload, get_all_db_categories,
                            get_user, remove_underscore)

from ...home.form_helpers import PIC_PART_BY_TYPE, save_pictures
from repz.services.question_service import (
    QuestionDraft,
    QuestionValidationError,
    apply_draft,
    create_question,
)


# adds a new category
@quest_ajx.route("/addcat", methods=["POST"], endpoint="addcat")
@login_required
def addcat():
    """Create a category. Answers with the name the picker should select."""
    name = (request.form.get("add_category_field") or "").strip()

    if len(name) < 3:
        return jsonify({"error": "A category name needs at least 3 characters."}), 400

    existing = session.execute(
        select(category).where(category.category_name == name)
    ).first()
    if existing is not None:
        return jsonify({"error": "That category already exists."}), 409

    session.add(category(category_name=name))
    session.commit()
    cache.set("category_list", get_all_db_categories(), timeout=60 * 60 * 24)

    return jsonify({"name": name})


def _owned_question(question_id, *options):
    """Load a question the caller authored, or None.

    The editors only ever list the caller's own questions, so a miss here means
    a forged id rather than a reachable UI state. Answering 404 rather than 403
    keeps it from confirming that someone else's question exists.
    """
    query = session.query(question)
    if options:
        query = query.options(*options)
    return query.filter(
        question.question_id == question_id,
        question.created_by == current_user.id,
    ).first()


def _question_payload(req):
    """Read the question JSON out of the multipart body both editors post."""
    raw = req.form.get("question")
    if not raw:
        raise QuestionValidationError("Missing question payload.")
    try:
        return json.loads(raw)
    except ValueError:
        raise QuestionValidationError("Malformed question payload.") from None


# create a question - the add-content page and the AI question generator both
# post here, so a question is born exactly one way whoever wrote it
@quest_ajx.route("/addq", methods=["POST"], endpoint="addq")
@login_required
def addq():
    try:
        payload = _question_payload(request)
        new_question = create_question(
            QuestionDraft.from_payload(payload),
            created_by=current_user.id,
            files_request=request,
        )
    except ValueError as err:
        # Covers a rejected draft and a rejected upload filename alike.
        return jsonify({"error": str(err)}), 400

    return jsonify({"id": new_question.question_id})


# save question changes within the edit question page
@quest_ajx.route("/saveq", methods=["POST"], endpoint="saveq")
@login_required
def saveq():
    try:
        payload = _question_payload(request)
    except QuestionValidationError as err:
        return jsonify({"error": str(err)}), 400

    q = _owned_question(payload.get("id"))
    if q is None:
        return jsonify({"error": "Question not found."}), 404

    # Nothing is destroyed until the draft is known to be writable.
    try:
        apply_draft(q, QuestionDraft.from_payload(payload))
    except QuestionValidationError as err:
        return jsonify({"error": str(err)}), 400

    # Images the editor dropped are the ones it did not send back.
    kept = payload.get("pics_by_type") or {}
    for pic in list(q.pics):
        part = PIC_PART_BY_TYPE.get(pic.pic_type)
        if part and pic.pic_string not in set(kept.get(part) or []):
            delete_pic(pic)

    try:
        save_pictures(q, request)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    session.commit()

    invalidate_quiz_queue_cache(current_user.id)

    return jsonify({"id": q.question_id})

# not quemore search button
@quest_ajx.route("/searchq", methods=["POST"], endpoint="searchq")
@login_required
def searchq():
    UID = g._login_user.id
    # get The submitted Json values
    filters = request.get_json()

    underscored_cats = filters["search-categories"]

    filter_cats = list(map(lambda x: remove_underscore(x), underscored_cats))

    excluded_chkbox = filters['excluded-filter-checkbox']

    # query db
    # list of column names to search
    column_names = filters["search-within"]

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
    if excluded_chkbox is False:
        # update query to exclude them
        query = query.filter(~question.question_id.in_(excluded_question_ids))
    else:
        query = query.filter(question.question_id.in_(excluded_question_ids))

    for column_name in column_names:
        query = query.filter(or_(getattr(question, column_name).contains(search_value)))

    selected_flags = filters.get("flag-categories") or []
    if selected_flags:
        try:
            flag_values = [FlagCategory(v) for v in selected_flags if v != "UNFLAGGED"]
        except ValueError:
            return jsonify({"error": "Invalid flag category."}), 400

        user_flags = session.query(flag).filter(
            flag.user_id == UID,
            flag.question_id == question.question_id,
        )

        flag_clauses = []
        if flag_values:
            flag_clauses.append(
                user_flags.filter(flag.flag_category.in_(flag_values)).exists()
            )
        if "UNFLAGGED" in selected_flags:
            flag_clauses.append(~user_flags.exists())

        query = query.filter(or_(*flag_clauses))

    # execute the query
    results = query.all()

    result_ids = [r.question_id for r in results]
    flags_by_qid = {}
    if result_ids:
        flag_rows = session.query(flag).filter(
            flag.user_id == UID,
            flag.question_id.in_(result_ids),
        ).all()
        for f in flag_rows:
            flags_by_qid[f.question_id] = flag_payload(f)

    search_results = []
    for r in results:
        catz = []
        for c in r.categories:
            catz.append(c.category_name)

        q = {
            "question_text": r.question_text,
            "question_id": r.question_id,
            "categories": catz,
            "flag": flags_by_qid.get(r.question_id),
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

    pics_by_type = {part: [] for part in PIC_PART_BY_TYPE.values()}
    for pic in question_obj.pics:
        part = PIC_PART_BY_TYPE.get(pic.pic_type)
        if part:
            pics_by_type[part].append(
                {"pic_string": pic.pic_string, "pic_id": pic.pic_id}
            )

    audio_files = []
    # Query audio records directly to avoid relationship loading/stale cache issues
    audio_records = session.query(audio).filter_by(question_id=question_id).all()
    from flask import url_for
    for aud in audio_records:
        play_url = url_for("audio.serve_audio_file", audio_id=aud.audio_id) if aud.audio_id else aud.public_url
        audio_files.append({
            "audio_id": aud.audio_id,
            "part": aud.part,
            "audio_text": aud.audio_text,
            "public_url": play_url,
            "language": aud.language,
            "object_key": aud.object_key,
        })

    q = {
        "question_text": question_obj.question_text,
        "hint": question_obj.hint,
        "answer": question_obj.answer,
        "id": question_obj.question_id,
        "pics_by_type": pics_by_type,
        "audio_files": audio_files,
        "categories": [c.category_name for c in question_obj.categories],
        "privacy": question_obj.privacy,
    }

    res_q = jsonify(q)
    response = make_response(res_q)
    # response.headers['Access-Control-Allow-Origin'] = '*'
    return response


@quest_ajx.route("/delete_audio", methods=["POST"], endpoint="delete_audio")
@login_required
def delete_audio():
    import logging
    data = request.get_json()
    audio_id = data.get("audio_id")
    if not audio_id:
        return jsonify({"error": "Missing audio ID"}), 400

    aud = session.query(audio).filter_by(audio_id=audio_id).first()
    if not aud:
        return jsonify({"error": "Audio asset not found"}), 404

    # Delete from S3 if object_key exists
    if aud.object_key:
        try:
            s3 = get_s3()
            s3.delete_s3_object(object_name=aud.object_key)
        except Exception as e:
            logging.error(f"Error deleting audio from S3: {e}")

    # Delete from database
    session.delete(aud)
    session.commit()

    return jsonify({"success": True})


@quest_ajx.route("/deleteq", methods=["POST"], endpoint="deleteq")
@login_required
def deleteq():
    delete_q = request.get_json()
    question_id = delete_q["id"]

    q = _owned_question(question_id, joinedload(question.pics))
    if q is None:
        return jsonify({"error": "Question not found."}), 404

    # gather the q_pics and remove them from s3
    q_pics = q.pics

    # loop over the q_pics and delete their corresponding objects in S3
    for pic in q_pics:
        delete_pic(pic)

    # find all entries in 'excluded_questions' where 'question_id' matches the question you want to delete
    q_users = session.query(users).filter(users.excluded_questions.contains(q)).all()

    for usr in q_users:
        usr.excluded_questions.remove(q)

    session.delete(q)
    session.commit()

    invalidate_quiz_queue_cache(current_user.id)

    msg = "Question Deleted"
    flash(msg, category="success")
    return msg


@quest_ajx.route("/all_categories", methods=["GET"], endpoint="all_categories")
@login_required
def all_categories():
    from repz.bluehelpers import get_all_categories
    return jsonify(get_all_categories())


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

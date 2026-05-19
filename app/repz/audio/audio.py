import logging
import random

from flask import (
    flash,
    g,
    redirect,
    render_template,
    request,
    url_for,
)
from flask_login import current_user, login_required
from sqlalchemy import select, update
from sqlalchemy.sql import func

from repz import cache
from repz.cache_helper import CacheHelper
from repz.routes import audio

from ..bluehelpers import (
    clean_for_html,
    get_all_categories,
    get_quizes,
    get_session,
    get_user,
    remove_underscore,
    set_session,
    tally_que_catz,
)
from ..database import session
from ..models import level, question, quizq


@audio.route("/audio", methods=["GET", "POST"], endpoint="audio_quiz")
@login_required
def audio_quiz():
    UID = g._login_user.id

    cats_due = []
    category_list = get_all_categories()
    time_now = func.now()

    if request.method == "GET":
        selected_categories = get_session("quiz_category_names")
        if selected_categories == "Not set":
            flash("You need to select some question categories.")
            return render_template(
                "audio.html",
                title="Audio Quiz",
                description="Mobile-optimised quiz mode.",
                user=current_user,
                category_list=category_list,
                q="",
                selected_categories=selected_categories,
            )
    else:
        selected_categories = request.form.getlist("category_name")
        set_session("quiz_category_names", selected_categories)

    cache_helper = CacheHelper(UID)
    que_list, que_cache_key = cache_helper.get_cached_questions(selected_categories)

    if request.method == "POST":
        incorrect_submit = request.form.get("incorrect_submit")
        correct_submit = request.form.get("correct_submit")
        quizq_id_str = request.form.get("quizq-id")
        start_quiz = request.form.get("start-quiz")
        exclude_question = request.form.get("exclude-question-button")

        quizq_id = int(quizq_id_str) if quizq_id_str is not None else ""

        # ── Exclude question ──────────────────────────────────────────────
        if start_quiz is None and exclude_question == "exclude":
            cur_user = get_user(UID)

            q_id = session.execute(
                select(quizq.question_id).where(quizq.quizq_id == quizq_id)
            ).scalar()

            excluded_q_obj = session.execute(
                select(question).where(question.question_id == q_id)
            ).first()[0]

            cur_user.excluded_questions.append(excluded_q_obj)

            if len(que_list) > 0:
                for i, q in enumerate(que_list):
                    if q["quizq_id"] == quizq_id:
                        que_list.pop(i)
                        break
                cache.set(que_cache_key, que_list, timeout=600)

            session.add(cur_user)
            session.commit()
            return redirect(url_for("audio.audio_quiz"))

        # ── Correct / Wrong submission ────────────────────────────────────
        if start_quiz is None and (
            correct_submit == "Correct!" or incorrect_submit == "Wrong!"
        ):
            current_quiz = session.execute(
                select(quizq)
                .where(quizq.answered_on == None)  # noqa: E711
                .where(quizq.user_id == UID)
                .where(quizq.quizq_id == quizq_id)
            ).scalars().all()

            if not current_quiz:
                logging.warning(
                    f"RACE/STALE DETECTED (audio): User {UID} submitted quizq_id {quizq_id}, "
                    "but DB says it is already answered."
                )
                if que_list:
                    que_list = [
                        q for q in que_list
                        if str(q.get("quizq_id")) != str(quizq_id)
                    ]
                    cache.set(que_cache_key, que_list, timeout=600)
                flash("This question was already submitted!", category="warning")
                return redirect(url_for("audio.audio_quiz"))

            update_stmt = (
                update(quizq)
                .where(quizq.quizq_id == current_quiz[0].quizq_id)
                .values(answered_on=time_now)
            )

            if correct_submit == "Correct!":
                max_lvl = session.execute(select(func.max(level.level_no))).scalar()
                new_lvl = (
                    current_quiz[0].level_no + 1
                    if current_quiz[0].level_no < max_lvl
                    else None
                )
                update_stmt = update_stmt.values(correct=True)
                if que_list is not None:
                    for i in range(len(que_list) - 1, -1, -1):
                        if str(que_list[i].get("quizq_id")) == str(quizq_id):
                            que_list.pop(i)
                            break
                    cache.set(que_cache_key, que_list, timeout=600)

            else:  # incorrect_submit == "Wrong!"
                update_stmt = update_stmt.values(correct=False)
                new_lvl = 1
                if que_list:
                    que_list = [q for q in que_list if q["quizq_id"] != quizq_id]
                    cache.set(que_cache_key, que_list, timeout=600)

            if new_lvl is not None:
                session.add(
                    quizq(
                        question_id=current_quiz[0].question_id,
                        user_id=UID,
                        level_no=new_lvl,
                    )
                )
                session.commit()

            session.execute(update_stmt)
            session.commit()
            return redirect(url_for("audio.audio_quiz"))

        # ── Validation: no categories selected ───────────────────────────
        if len(selected_categories) < 1:
            flash("You didn't select any question categories! Try again.")
            return render_template(
                "audio.html",
                title="Audio Quiz",
                description="Mobile-optimised quiz mode.",
                user=current_user,
                category_list=category_list,
                q="",
                selected_categories=selected_categories,
            )

    # ── Populate / refresh question list ─────────────────────────────────
    if len(que_list) < 1:
        selected_cats = [remove_underscore(x) for x in selected_categories]
        que_list = get_quizes(selected_cats, UID)
        cache.set(que_cache_key, que_list, timeout=600)

    success_msg = (
        "Congratulations! You've completed all the questions currently due! "
        "You have two options: Either wait for the questions you've already answered "
        "to come due again, or start answering more questions immediately by expanding "
        "your training queue."
    )

    if len(que_list) < 1:
        if len(selected_categories) == len(category_list):
            flash(success_msg)
            return redirect(url_for("home.quemore"))
        else:
            unselected_cat_quizes = get_quizes(category_list, UID)
            if len(unselected_cat_quizes) < 1:
                flash(success_msg)
                return redirect(url_for("home.quemore"))
            else:
                cats_w_quizes = tally_que_catz(unselected_cat_quizes)
                cats_due_txt = ""
                for cat, num in cats_w_quizes.items():
                    cats_due_txt += f"{cat}: {num}, "
                    cats_due.append(clean_for_html(cat))
                flash(
                    "No more questions in your selected categories are currently due. "
                    "Either queue more questions for those categories or select the "
                    "following categories which have questions due: " + cats_due_txt
                )
        q = ""
    else:
        sorted_que_list = sorted(
            que_list,
            key=lambda k: (k["last_ansered"] is None, k["last_ansered"]),
        )
        sorted_que_list = sorted_que_list[:17] if len(sorted_que_list) > 30 else sorted_que_list[:7]
        q = random.choice(sorted_que_list)

    return render_template(
        "audio.html",
        title="Audio Quiz",
        description="Mobile-optimised quiz mode.",
        user=current_user,
        category_list=category_list,
        q=q,
        selected_categories=selected_categories,
        cats_due=cats_due,
    )

import hashlib
import logging
import random
from dataclasses import dataclass
from typing import Any

from flask import flash, redirect, render_template, request, url_for, g
from flask_login import current_user
from sqlalchemy import select, update
from sqlalchemy.sql import func

from repz import cache
from repz.cache_helper import CacheHelper
from repz.database import session
from repz.models import level, question, quizq
from repz.bluehelpers import (
    clean_for_html,
    get_all_categories,
    get_quizes,
    get_session,
    get_user,
    remove_underscore,
    set_session,
    tally_que_catz,
)


@dataclass(frozen=True)
class QuizPageConfig:
    mode: str
    template_name: str
    endpoint_name: str
    title: str
    description: str


def render_quiz_page(config: QuizPageConfig, audio_service=None):
    """Shared route workflow for normal quiz and audio quiz."""
    UID = g._login_user.id

    cats_due = []
    category_list = get_all_categories()

    selected_categories = _get_selected_categories()

    if selected_categories == "Not set":
        msg = "You need to select some question categories."
        flash(msg)
        return render_template(
            config.template_name,
            title=config.title,
            description=config.description,
            user=current_user,
            category_list=category_list,
            q="",
            selected_categories=selected_categories,
        )

    cache_helper = CacheHelper(UID)
    que_list, que_cache_key = cache_helper.get_cached_questions(selected_categories)

    if request.method == "POST":
        redirect_response = _handle_quiz_post(
            user_id=UID,
            que_list=que_list,
            que_cache_key=que_cache_key,
            endpoint_name=config.endpoint_name,
        )
        if redirect_response is not None:
            return redirect_response

        if len(selected_categories) < 1:
            flash("You didn't select any question categories! Try again.")
            return render_template(
                config.template_name,
                title=config.title,
                description=config.description,
                user=current_user,
                category_list=category_list,
                q="",
                selected_categories=selected_categories,
            )

    if len(que_list) < 1:
        selected_cats = [remove_underscore(x) for x in selected_categories]
        que_list = get_quizes(selected_cats, UID)
        cache.set(que_cache_key, que_list, timeout=600)

    q, maybe_redirect = _select_next_question_or_redirect(
        que_list=que_list,
        selected_categories=selected_categories,
        category_list=category_list,
        cats_due=cats_due,
        user_id=UID,
    )

    if maybe_redirect is not None:
        return maybe_redirect

    audio_assets = {}

    if config.mode == "audio" and q and audio_service is not None:
        logging.info(f"🎵 Generating audio assets for question {q.get('question_id')}")

        try:
            raw_assets = audio_service.ensure_audio_for_quiz_question(
                q=q,
                user=current_user,
                parts=("question", "answer", "hint"),
            )
            logging.info(f"📦 Service returned raw assets: {raw_assets}")
        except Exception as e:
            logging.error(f"❌ Failed to generate audio assets: {e}")
            raw_assets = {}

        audio_assets = _build_audio_assets_for_template(q=q, raw_assets=raw_assets)

        logging.info(f"🎯 Final audio_assets for template: {audio_assets}")

    template_vars = {
        "title": config.title,
        "description": config.description,
        "user": current_user,
        "category_list": category_list,
        "q": q,
        "selected_categories": selected_categories,
        "cats_due": cats_due,
        "audio_assets": audio_assets,
    }

    if config.mode == "audio":
        logging.info(f"🎨 Rendering audio template with assets: {bool(audio_assets)}")
        if q:
            logging.info(f"📄 Question: {q.get('question_text', '')[:50]}...")

    return render_template(config.template_name, **template_vars)


def _build_audio_assets_for_template(q: dict, raw_assets: dict) -> dict:
    """
    Convert AudioAssetService's language-keyed result into the shape expected by audio.html.

    Input:
    {
        "en_US": {
            "question": "http://...",
            "answer": "http://..."
        },
        "es_MX": {
            "question": "http://...",
            "answer": "http://..."
        }
    }

    Output:
    {
        "question": [
            {"lang": "en_US", "url": "/audio/object/audio/en_US/..."},
            {"lang": "es_MX", "url": "/audio/object/audio/es_MX/..."}
        ],
        "answer": [
            {"lang": "en_US", "url": "/audio/object/audio/en_US/..."},
            {"lang": "es_MX", "url": "/audio/object/audio/es_MX/..."}
        ]
    }

    The raw service result proves which audio assets were successfully ensured.
    This function then builds local proxy URLs for the template.
    """
    audio_assets = {}

    if not raw_assets:
        return audio_assets

    part_to_text = {
        "question": q.get("question_text"),
        "answer": q.get("answer"),
        "hint": q.get("hint"),
    }

    for lang, lang_assets in raw_assets.items():
        for part, ensured_asset_url in lang_assets.items():
            if not ensured_asset_url:
                logging.warning(
                    f"⚠️ Empty ensured asset URL for language={lang}, part={part}"
                )
                continue

            source_text = part_to_text.get(part)

            if not source_text:
                logging.warning(
                    f"⚠️ Source text missing for language={lang}, part={part}; "
                    f"skipping URL generation"
                )
                continue

            text_hash = hashlib.sha256(source_text.encode("utf-8")).hexdigest()
            object_key = f"audio/{lang}/{q['question_id']}/{part}-{text_hash}.mp3"
            audio_url = url_for("audio.serve_audio_by_key", object_key=object_key)

            audio_assets.setdefault(part, []).append({
                "lang": lang,
                "url": audio_url,
            })

            logging.info(f"🔗 Added {part} ({lang}) audio local URL: {audio_url}")

    return audio_assets


def _get_selected_categories():
    """One source of truth for category session/form behavior."""
    if request.method == "GET":
        saved_names = get_session("quiz_category_names")
        if saved_names == "Not set" or not saved_names:
            # Check if user has a default category list
            from repz.models import category_lists
            from repz.database import session
            default_list = session.execute(
                select(category_lists)
                .where(category_lists.user_id == current_user.id)
                .where(category_lists.is_default == True)
            ).scalars().first()
            if default_list:
                saved_names = [c.category_name.replace(" ", "_") for c in default_list.categories]
                set_session("quiz_category_names", saved_names)
        return saved_names

    selected_categories = request.form.getlist("category_name")
    set_session("quiz_category_names", selected_categories)
    return selected_categories


def _handle_quiz_post(
    user_id: int,
    que_list: list[dict[str, Any]],
    que_cache_key: str,
    endpoint_name: str,
):
    """Shared POST action handling for both quiz modes."""
    incorrect_submit = request.form.get("incorrect_submit")
    correct_submit = request.form.get("correct_submit")
    quizq_id_str = request.form.get("quizq-id")
    start_quiz = request.form.get("start-quiz")
    provided_answer = request.form.get("provided-answer")
    exclude_question = request.form.get("exclude-question-button")

    if quizq_id_str is not None:
        quizq_id = int(quizq_id_str)
    else:
        quizq_id = 0

    if start_quiz is not None:
        return None

    if (
        (start_quiz is None)
        and (exclude_question == "exclude")
        and quizq_id != 0
    ):
        _exclude_quiz_question(user_id, quizq_id, que_list, que_cache_key)
        return redirect(url_for(endpoint_name))

    if (
        (start_quiz is None)
        and ((correct_submit == "Correct!") or (incorrect_submit == "Wrong!"))
        and quizq_id != 0
    ):
        is_correct = correct_submit == "Correct!"
        _submit_quiz_answer(
            user_id=user_id,
            quizq_id=quizq_id,
            is_correct=is_correct,
            provided_answer=provided_answer,
            que_list=que_list,
            que_cache_key=que_cache_key,
            endpoint_name=endpoint_name,
        )
        return redirect(url_for(endpoint_name))

    return None


def _exclude_quiz_question(
    user_id: int,
    quizq_id: int,
    que_list: list[dict[str, Any]],
    que_cache_key: str,
):
    """One exclude implementation used by both visual and audio modes."""
    cur_user = get_user(user_id)

    q_id_qry = select(quizq.question_id).where(quizq.quizq_id == quizq_id)
    q_id = session.execute(q_id_qry).scalar()

    excluded_q_qry = select(question).where(question.question_id == q_id)
    excluded_q_result = session.execute(excluded_q_qry).first()

    if excluded_q_result is None:
        return

    excluded_q_obj = excluded_q_result[0]
    cur_user.excluded_questions.append(excluded_q_obj)

    if len(que_list) > 0:
        for i, q in enumerate(que_list):
            if q["quizq_id"] == quizq_id:
                que_list.pop(i)
                break

        cache.set(que_cache_key, que_list, timeout=600)

    session.add(cur_user)
    session.commit()


def _submit_quiz_answer(
    user_id: int,
    quizq_id: int,
    is_correct: bool,
    provided_answer: str | None,
    que_list: list[dict[str, Any]],
    que_cache_key: str,
    endpoint_name: str,
):
    """One correct/wrong implementation used by both routes."""
    time_now = func.now()

    qry = (
        select(quizq)
        .where(quizq.answered_on.is_(None))
        .where(quizq.user_id == user_id)
        .where(quizq.quizq_id == quizq_id)
    )
    current_quiz = session.execute(qry).scalars().all()

    if not current_quiz:
        logging.warning(
            f"RACE/STALE DETECTED: User {user_id} submitted quizq_id {quizq_id}, "
            f"but DB says it is already answered."
        )
        logging.warning(f"Debug - Active Cache Key: {que_cache_key}")

        current_ids_in_cache = (
            [q.get("quizq_id") for q in que_list] if que_list else "List is Empty"
        )
        logging.warning(f"Debug - IDs currently in this Cache Key: {current_ids_in_cache}")

        if que_list:
            original_count = len(que_list)

            que_list[:] = [
                q for q in que_list
                if str(q.get("quizq_id")) != str(quizq_id)
            ]

            if len(que_list) < original_count:
                logging.info(
                    f"SELF-HEAL SUCCESS: Forced removal of stale quizq_id "
                    f"{quizq_id} from Redis."
                )
                cache.set(que_cache_key, que_list, timeout=600)
            else:
                logging.error(
                    f"SELF-HEAL FAILED: Could not find quizq_id {quizq_id} "
                    f"in the list to remove it."
                )

        flash("This question was already submitted!", category="warning")
        return

    update_stmt = (
        update(quizq)
        .where(quizq.quizq_id == current_quiz[0].quizq_id)
        .values(answered_on=time_now, provided_answer=provided_answer)
    )

    if is_correct:
        max_lvl = session.execute(select(func.max(level.level_no))).scalar()

        if current_quiz[0].level_no < max_lvl:
            new_lvl = current_quiz[0].level_no + 1
        else:
            new_lvl = None

        update_stmt = update_stmt.values(correct=True)

        if que_list is not None:
            for i in range(len(que_list) - 1, -1, -1):
                if str(que_list[i].get("quizq_id")) == str(quizq_id):
                    logging.info(f"Successfully popped quizq_id {quizq_id} from list index {i}")
                    que_list.pop(i)
                    break
            else:
                logging.warning(
                    f"FAILED to find quizq_id {quizq_id} in que_list "
                    f"during success update!"
                )

            cache.set(que_cache_key, que_list, timeout=600)

    else:
        update_stmt = update_stmt.values(correct=False)
        new_lvl = 1

        if len(que_list) > 0:
            que_list[:] = [
                q for q in que_list
                if q["quizq_id"] != quizq_id
            ]
            cache.set(que_cache_key, que_list, timeout=600)

    if new_lvl is not None:
        new_quizq = quizq(
            question_id=current_quiz[0].question_id,
            user_id=user_id,
            level_no=new_lvl,
        )
        session.add(new_quizq)
        session.commit()

    session.execute(update_stmt)
    session.commit()


def _select_next_question_or_redirect(
    que_list: list[dict[str, Any]],
    selected_categories: list[str],
    category_list: list[str],
    cats_due: list[str],
    user_id: int,
):
    """One next-question selection implementation for both modes."""
    success_msg = (
        "Congradulations! You've completed all the questions currently due! "
        "You have two options: Either wait for the questions you've already "
        "answered to come due again, or to start answering more questions "
        "immediately you need to expand your training que! For the ladder option, "
        "select how many more questions you'd like to add to your que below and "
        "click 'Add More'"
    )

    if len(que_list) < 1:
        if len(selected_categories) == len(category_list):
            flash(success_msg)
            return "", redirect(url_for("home.quemore"))

        unselected_cat_quizes = get_quizes(category_list, user_id)

        if len(unselected_cat_quizes) < 1:
            flash(success_msg)
            return "", redirect(url_for("home.quemore"))

        cats_w_quizes = tally_que_catz(unselected_cat_quizes)

        cats_due_txt = ""
        for cat, num in cats_w_quizes.items():
            cats_due_txt += f"{cat}: {num}, "
            cleaned_cat = clean_for_html(cat)
            cats_due.append(cleaned_cat)

        msg_txt = (
            "No more questions in your selected categories are currently due. "
            "Either que more questions for those categories or select the "
            "following categories which have questions due: "
        )
        msg = msg_txt + cats_due_txt
        flash(msg)

        return "", None

    sorted_que_list = sorted(
        que_list,
        key=lambda k: (k["last_ansered"] is None, k["last_ansered"]),
    )

    if len(sorted_que_list) > 30:
        sorted_que_list = sorted_que_list[:17]
    else:
        sorted_que_list = sorted_que_list[:7]

    q = random.choice(sorted_que_list)
    return q, None
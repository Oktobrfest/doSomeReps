import hashlib
import logging
import random
from enum import StrEnum
from typing import Any

from flask import flash, url_for
from flask_login import current_user
from sqlalchemy import select, update
from sqlalchemy.sql import func

from repz.extensions import cache
from repz.cache_helper import CacheHelper
from repz.database import session
from repz.models import level, question, quizq
from repz.bluehelpers import (
    get_quizes,
    get_session,
    get_user,
    remove_underscore,
    set_session,
)


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------


class AnswerVerdict(StrEnum):
    """
    The three possible outcomes a user can submit for a quiz question.

    The string values are part of the quiz API contract: the SPA sends them
    verbatim as the `verdict` field of a submit action.
    """

    CORRECT = "Correct!"
    WRONG = "Wrong!"
    SLIGHTLY_WRONG = "Slightly Wrong"

    @property
    def is_correct(self) -> bool:
        return self is AnswerVerdict.CORRECT

    @property
    def is_wrong(self) -> bool:
        return self in (AnswerVerdict.WRONG, AnswerVerdict.SLIGHTLY_WRONG)

    @property
    def is_slightly_wrong(self) -> bool:
        return self is AnswerVerdict.SLIGHTLY_WRONG


def _build_audio_assets_for_template(q: dict, raw_assets: dict) -> dict:
    """
    Convert AudioAssetService's language-keyed result into the shape the SPA expects.

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
    audio_assets: dict[str, list[dict[str, str]]] = {}

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


def get_selected_categories() -> list[str] | str:
    """
    The categories the current user is quizzing on, as slugs.

    Falls back to the user's default category list the first time they arrive,
    and returns the sentinel "Not set" when they have never chosen any.
    """
    saved_names = get_session("quiz_category_names")

    if saved_names == "Not set" or not saved_names:
        from repz.models import category_lists

        default_list = session.execute(
            select(category_lists)
            .where(category_lists.user_id == current_user.id)
            .where(category_lists.is_default == True)
        ).scalars().first()

        if default_list:
            saved_names = [
                c.category_name.replace(" ", "_") for c in default_list.categories
            ]
            set_selected_categories(saved_names)

    return saved_names


def set_selected_categories(category_slugs: list[str]) -> None:
    """Persist the user's category selection for subsequent quiz requests."""
    set_session("quiz_category_names", category_slugs)


def exclude_quiz_question(
    user_id: int,
    quizq_id: int,
    que_list: list[dict[str, Any]],
    que_cache_key: str,
):
    """Exclude a question from the user's queue for good."""
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


def submit_quiz_answer(
    user_id: int,
    quizq_id: int,
    verdict: AnswerVerdict,
    provided_answer: str | None,
    que_list: list[dict[str, Any]],
    que_cache_key: str,
):
    """Record a Correct / Wrong / Slightly Wrong verdict and re-level the question."""
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

    if verdict.is_correct:
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
        if verdict.is_slightly_wrong:
            if current_quiz[0].level_no > 3:
                new_lvl = 3
            else:
                new_lvl = max(current_quiz[0].level_no - 1, 1)
        else:
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


def pick_next_questions(
    que_list: list[dict[str, Any]],
    count: int = 1,
    exclude_quizq_ids: list[str | int] | None = None,
) -> list[dict[str, Any]]:
    """
    Return up to `count` distinct questions from the same priority slice used by
    the page renderer.  Optionally excludes one or more quizq_ids (e.g. the
    currently displayed question) so the queued question is never the same.
    """
    if not que_list or count <= 0:
        return []

    sorted_que_list = sorted(
        que_list,
        key=lambda k: (k["last_ansered"] is None, k["last_ansered"]),
    )

    if len(sorted_que_list) > 30:
        sorted_que_list = sorted_que_list[:17]
    else:
        sorted_que_list = sorted_que_list[:7]

    exclude_set = {str(x) for x in (exclude_quizq_ids or [])}
    candidates = [
        q for q in sorted_que_list
        if str(q.get("quizq_id")) not in exclude_set
    ]

    if len(candidates) <= count:
        return candidates

    return random.sample(candidates, count)


def get_quiz_queue(
    user_id: int,
    selected_categories: list[str] | str,
) -> list[dict[str, Any]]:
    """
    Load the user's cached quiz queue for the selected categories, rebuilding
    it from the database when the cache is empty.
    """
    if selected_categories == "Not set" or not selected_categories:
        return []

    cache_helper = CacheHelper(user_id)
    que_list, que_cache_key = cache_helper.get_cached_questions(selected_categories)

    if len(que_list) < 1:
        selected_cats = [remove_underscore(x) for x in selected_categories]
        que_list = get_quizes(selected_cats, user_id)
        cache.set(que_cache_key, que_list, timeout=600)

    return que_list


def build_quiz_items(
    que_list: list[dict[str, Any]],
    user,
    count: int = 1,
    exclude_quizq_ids: list[str | int] | None = None,
    audio_service=None,
) -> list[dict[str, Any]]:
    """
    Build fully-populated SPA quiz items ({question, audioAssets}) for the next
    `count` questions in the queue.

    Text-to-speech is only run when an `audio_service` is supplied, so readers
    who have audio switched off never pay for audio generation.  Generation
    failures are logged and do not block the item from being returned.
    """
    questions = pick_next_questions(que_list, count, exclude_quizq_ids)
    items: list[dict[str, Any]] = []

    for q in questions:
        q["flag"] = _get_question_flag(user_id=user.id, question_id=q["question_id"])
        items.append({
            "question": q,
            "audioAssets": build_audio_assets(q, user, audio_service),
        })

    return items


def build_audio_assets(q: dict[str, Any], user, audio_service) -> dict:
    """Ensure and describe the audio assets for one question, or {} without a service."""
    if audio_service is None:
        return {}

    try:
        raw_assets = audio_service.ensure_audio_for_quiz_question(
            q=q,
            user=user,
            parts=("question", "answer", "hint"),
        )
    except Exception as e:
        logging.error(f"❌ Failed to generate audio assets for quizq {q.get('quizq_id')}: {e}")
        raw_assets = {}

    return _build_audio_assets_for_template(q=q, raw_assets=raw_assets)


def _get_question_flag(user_id: int, question_id) -> dict[str, Any] | None:
    """The current user's flag on a question, in the shape the SPA expects."""
    from repz.models import flag

    try:
        f = session.query(flag).filter_by(
            user_id=user_id, question_id=question_id
        ).first()
    except Exception as e:
        logging.error(f"❌ Failed to fetch flag for question {question_id}: {e}")
        return None

    if not f:
        return None

    return {
        "category": (
            f.flag_category.value
            if hasattr(f.flag_category, "value")
            else str(f.flag_category)
        ),
        "note": f.note,
    }

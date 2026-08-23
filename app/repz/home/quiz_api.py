"""
JSON API behind the quiz SPA.

The quiz page never posts a form: it asks for a queue of questions, then
reports verdicts, exclusions and category changes through these endpoints and
swaps in the next queued question without a reload.
"""

from flask import jsonify, request
from flask_login import current_user, login_required

from repz.routes import home
from repz.bluehelpers import get_all_categories, get_quizes, tally_que_catz
from repz.cache_helper import CacheHelper
from repz.services.quiz_service import (
    AnswerVerdict,
    build_audio_assets,
    build_quiz_items,
    get_quiz_queue,
    get_selected_categories,
    set_selected_categories,
    exclude_quiz_question,
    submit_quiz_answer,
)

NO_CATEGORIES_MESSAGE = "You need to select some question categories."

ALL_DONE_MESSAGE = (
    "Congradulations! You've completed all the questions currently due! "
    "You have two options: Either wait for the questions you've already "
    "answered to come due again, or to start answering more questions "
    "immediately you need to expand your training que!"
)

OTHER_CATEGORIES_DUE_MESSAGE = (
    "No more questions in your selected categories are currently due. "
    "Either que more questions for those categories or select the "
    "following categories which have questions due: "
)


def _exhausted(message: str):
    return jsonify({"items": [], "queueExhausted": True, "message": message})


def _exhausted_with_suggestions(selected_categories, user_id: int):
    """
    Report an empty queue, naming other categories that do have questions due.

    Falls back to the generic "all done" message when nothing is due anywhere.
    """
    selected = selected_categories if isinstance(selected_categories, list) else []
    selected_names = [c.replace("_", " ") for c in selected]
    unselected = [c for c in get_all_categories() if c not in selected_names]

    if unselected:
        due_elsewhere = get_quizes(unselected, user_id)
        if due_elsewhere:
            tally = tally_que_catz(due_elsewhere)
            cats_due_txt = "".join(f"{cat}: {num}, " for cat, num in tally.items())
            return _exhausted(OTHER_CATEGORIES_DUE_MESSAGE + cats_due_txt)

    return _exhausted(ALL_DONE_MESSAGE)


def _audio_service_if(enabled: bool):
    """Build the TTS-backed audio service only when the reader wants audio."""
    if not enabled:
        return None

    from repz.audio.audio import build_audio_service

    return build_audio_service()


def _wants_audio() -> bool:
    return request.args.get("audio", "0") == "1"


@home.route("/quiz/queue", methods=["GET"], endpoint="quiz_queue")
@login_required
def quiz_queue():
    """Return the next `count` quiz items, with audio assets only if asked for."""
    selected_categories = get_selected_categories()
    if selected_categories == "Not set" or not selected_categories:
        return _exhausted(NO_CATEGORIES_MESSAGE)

    user_id = current_user.id
    que_list = get_quiz_queue(user_id, selected_categories)

    if not que_list:
        return _exhausted_with_suggestions(selected_categories, user_id)

    count = max(1, request.args.get("count", 1, type=int))

    exclude_raw = request.args.get("exclude_quizq_ids", "")
    exclude_quizq_ids = [x.strip() for x in exclude_raw.split(",") if x.strip()]

    items = build_quiz_items(
        que_list=que_list,
        user=current_user,
        count=count,
        exclude_quizq_ids=exclude_quizq_ids,
        audio_service=_audio_service_if(_wants_audio()),
    )

    if not items:
        # Everything still in the queue was excluded by the caller.
        return _exhausted_with_suggestions(selected_categories, user_id)

    return jsonify({"items": items, "queueExhausted": False, "message": ""})


@home.route("/quiz/audio-assets", methods=["GET"], endpoint="quiz_audio_assets")
@login_required
def quiz_audio_assets():
    """
    Audio for one already-loaded question.

    Used when a reader switches audio on part-way through a question, so the
    page does not have to throw away the question to gain a soundtrack.
    """
    quizq_id = request.args.get("quizq_id", type=int)
    if quizq_id is None:
        return jsonify({"ok": False, "error": "quizq_id is required."}), 400

    selected_categories = get_selected_categories()
    que_list = get_quiz_queue(current_user.id, selected_categories)

    question = next(
        (q for q in que_list if str(q.get("quizq_id")) == str(quizq_id)),
        None,
    )
    if question is None:
        return jsonify({"ok": False, "error": "Unknown question."}), 404

    assets = build_audio_assets(question, current_user, _audio_service_if(True))
    return jsonify({"ok": True, "audioAssets": assets})


@home.route("/quiz/api/categories", methods=["POST"], endpoint="quiz_set_categories")
@login_required
def quiz_set_categories():
    """Replace the reader's category selection, as slugs."""
    data = request.get_json(silent=True) or {}
    categories = data.get("categories")

    if not isinstance(categories, list) or not all(
        isinstance(c, str) for c in categories
    ):
        return jsonify({"ok": False, "error": "categories must be a list of strings."}), 400

    set_selected_categories(categories)
    return jsonify({"ok": True, "categories": categories})


@home.route("/quiz/api/action", methods=["POST"], endpoint="quiz_action")
@login_required
def quiz_action():
    """Apply a verdict or an exclusion to the question the reader just finished."""
    data = request.get_json(silent=True) or {}

    action = data.get("action")
    provided_answer = data.get("providedAnswer")

    try:
        quizq_id = int(data.get("quizqId"))
    except (TypeError, ValueError):
        return jsonify({
            "ok": False,
            "error": "quizqId is required and must be an integer.",
        }), 400

    selected_categories = get_selected_categories()
    if selected_categories == "Not set" or not selected_categories:
        return jsonify({"ok": False, "error": "No quiz categories are selected."}), 400

    cache_helper = CacheHelper(current_user.id)
    que_list, que_cache_key = cache_helper.get_cached_questions(selected_categories)

    if action == "exclude":
        exclude_quiz_question(
            user_id=current_user.id,
            quizq_id=quizq_id,
            que_list=que_list,
            que_cache_key=que_cache_key,
        )
        return jsonify({"ok": True, "action": "exclude", "quizqId": quizq_id})

    if action == "submit":
        verdict_raw = data.get("verdict")

        try:
            verdict = AnswerVerdict(verdict_raw)
        except ValueError:
            return jsonify({"ok": False, "error": f"Invalid verdict: {verdict_raw!r}"}), 400

        submit_quiz_answer(
            user_id=current_user.id,
            quizq_id=quizq_id,
            verdict=verdict,
            provided_answer=provided_answer,
            que_list=que_list,
            que_cache_key=que_cache_key,
        )

        return jsonify({
            "ok": True,
            "action": "submit",
            "quizqId": quizq_id,
            "verdict": verdict.value,
        })

    return jsonify({"ok": False, "error": f"Invalid action: {action!r}"}), 400

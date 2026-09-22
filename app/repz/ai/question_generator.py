"""AI Question Generator page.

Lets a user paste source material ("quiz content"), pick a desired
question-count range, and have the AI generate a batch of basic
question/answer pairs about it. Generated questions are rendered as
editable form-groups; the user can tweak them in place and then Save
(through `quest_ajx.addq`, the one route that writes a new question) or
Delete (drop from the working list).

A second, optional AI call generates hints for difficult questions
when the user ticks "Try to provide hints".
"""

import json
import logging
from typing import Any, Dict, List, Optional

from flask import (
    jsonify,
    render_template,
    request,
    session as local_session,
)
from flask_login import current_user, login_required

from repz.ai.prompts import (
    BASE_EXTEND_PROMPT,
    EXTEND_OPTIONS,
    build_extend_instructions,
)
from repz.routes import ai

from ..bluehelpers import get_session, set_session
from ..database import session as db_session
from ..models import question
from .litellm_client import AIConfigError, completion_for_user
from .qgen_service import ExtendedAnswer, _parse_extended_answer


# Session key holding the current batch of AI-generated questions
# (a list of dicts). Stored as plain JSON-serializable dicts so the
# Flask session backend doesn't need to know about Pydantic.
SESSION_KEY_GENERATED = "ai_qgen_generated_questions"



def _as_draft(item: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise one question onto the shape every editor in the app speaks.

    The generator's own schema calls the prompt "question"; everywhere else in
    the app - the add-content page, the editor, `question_service` - it is
    `question_text`. Translating once, here at the session boundary, keeps that
    one spelling from leaking into the React pages.
    """
    return {
        "question_text": (item.get("question_text") or item.get("question") or "").strip(),
        "hint": (item.get("hint") or "").strip() or None,
        "answer": (item.get("answer") or "").strip(),
        "categories": list(item.get("categories") or []),
        "privacy": bool(item.get("privacy")),
        "auto_que": bool(item.get("auto_que")),
    }


def _generated() -> List[Dict[str, Any]]:
    """The working list, in the shape the editors speak."""
    return [_as_draft(item) for item in local_session.get(SESSION_KEY_GENERATED, [])]


def _extend_one(
    draft: Dict[str, Any],
    custom_instructions: str = "",
    selected_options: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Return `draft` with its answer extended by the AI.

    The answer comes back in the strict SHORT ANSWER / LONG ANSWER layout so the
    editable answer field picks it up verbatim; the hint is overwritten only
    when the model produced one. Any underlying AI / parsing error is raised to
    the caller.
    """
    cats = draft.get("categories") or []

    prompt = BASE_EXTEND_PROMPT.format(
        categories=", ".join(cats) if cats else "(general)",
        question=draft.get("question_text") or "",
        current_answer=draft.get("answer") or "",
        user_instructions_block=build_extend_instructions(
            custom_instructions, selected_options
        ),
    )

    resp = completion_for_user(
        current_user,
        messages=[{"role": "user", "content": prompt}],
        response_format=ExtendedAnswer,
    )
    parsed = _parse_extended_answer(resp)

    return {
        **draft,
        "answer": (
            "SHORT ANSWER:\n"
            + parsed.short_answer.strip()
            + "\n\nLONG ANSWER:\n"
            + parsed.long_answer.strip()
        ),
        "hint": parsed.hint.strip() if parsed.hint else draft.get("hint"),
    }


# --- Route -----------------------------------------------------------

@ai.route(
    "/ai_question_generator",
    methods=["GET", "POST"],
    endpoint="question_generator",
)
@login_required
def question_generator():
    """Render the React page template."""
    return render_template(
        "ai_question_generator.html",
        title="AI Question Generator",
        description="Have AI generate quiz questions from your material.",
        user=current_user,
    )


@ai.route("/ai_question_generator/api/state", methods=["GET"])
@login_required
def ai_qgen_state():
    """Get the current state (generated questions and selected categories)."""
    generated_questions = _generated()
    selected_categories = get_session("ai_qgen_category_names")
    if selected_categories == "Not set":
        selected_categories = []
    return jsonify({
        "generated_questions": generated_questions,
        "selected_categories": selected_categories
    })


@ai.route("/ai_question_generator/api/generate", methods=["POST"])
@login_required
def ai_qgen_generate():
    """Trigger AI question generation."""
    import tempfile
    import os

    if request.is_json:
        data = request.get_json() or {}
        text = (data.get("quiz_content") or "").strip()
        selected_categories = data.get("categories") or []
        qty_from = data.get("qty_from", 5)
        qty_to = data.get("qty_to", 10)
        try_provide_hints = bool(data.get("try_provide_hints", False))
        avoid_duplicates = bool(data.get("avoid_duplicates", False))
        file_obj = None
    else:
        text = (request.form.get("quiz_content") or "").strip()
        cats_raw = request.form.get("categories")
        if cats_raw:
            try:
                selected_categories = json.loads(cats_raw)
            except Exception:
                selected_categories = request.form.getlist("categories")
        else:
            selected_categories = []
        qty_from = request.form.get("qty_from", 5)
        qty_to = request.form.get("qty_to", 10)
        try_provide_hints = request.form.get("try_provide_hints") == "true"
        avoid_duplicates = request.form.get("avoid_duplicates") == "true"
        file_obj = request.files.get("file")

    if not selected_categories:
        return jsonify({"success": False, "error": "At least one category is required."}), 400

    # Validate quantities
    try:
        qty_from = int(qty_from)
        qty_to = int(qty_to)
        if not (0 <= qty_from <= 50) or not (0 <= qty_to <= 50):
            raise ValueError()
    except ValueError:
        return jsonify({"success": False, "error": "Quantities must be between 0 and 50."}), 400

    set_session("ai_qgen_category_names", selected_categories)

    try:
        UID = current_user.id
        if file_obj and file_obj.filename:
            filename = file_obj.filename.lower()
            if filename.endswith(".pdf"):
                doc_type = "pdf"
            elif filename.endswith((".png", ".jpg", ".jpeg")):
                doc_type = "image"
            else:
                return jsonify({
                    "success": False,
                    "error": "Unsupported file format. Please upload a PDF or an image (PNG, JPG, JPEG)."
                }), 400

            import uuid
            from repz.s3_ext import get_s3

            suffix = os.path.splitext(filename)[1]
            s3_object_key = f"temp_uploads/{uuid.uuid4()}{suffix}"

            # Save upload to a local temp file so we can upload it to S3
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                file_obj.save(tmp.name)
                tmp_path = tmp.name

            try:
                s3_client = get_s3()
                content_type = file_obj.content_type or "application/octet-stream"
                s3_client.upload_file_to_s3(
                    tmp_path,
                    ExtraArgs={"ContentType": content_type},
                    object_name=s3_object_key,
                )
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

            from repz.hatchet_client import trigger_document_question_generation

            generated = trigger_document_question_generation(
                document_path=s3_object_key,
                document_type=doc_type,
                categories=selected_categories,
                qty_from=qty_from,
                qty_to=qty_to,
                user_id=UID,
                try_hints=try_provide_hints,
                avoid_duplicates=avoid_duplicates,
            )
        else:
            if not text:
                return jsonify({"success": False, "error": "Quiz content is required."}), 400

            from repz.hatchet_client import trigger_question_generation

            generated = trigger_question_generation(
                text_content=text,
                categories=selected_categories,
                qty_from=qty_from,
                qty_to=qty_to,
                user_id=UID,
                try_hints=try_provide_hints,
                avoid_duplicates=avoid_duplicates,
            )

        drafts = [_as_draft(item) for item in generated]
        local_session[SESSION_KEY_GENERATED] = drafts
        return jsonify({
            "success": True,
            "generated_questions": drafts,
            "selected_categories": selected_categories
        })
    except AIConfigError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        logging.exception("AI question generation failed")
        return jsonify({"success": False, "error": f"AI request failed: {e}"}), 500


@ai.route("/ai_question_generator/api/delete", methods=["POST"])
@login_required
def ai_qgen_delete_one():
    """Delete a single generated question from the working list."""
    data = request.get_json() or {}
    try:
        idx = int(data.get("index"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Invalid index."}), 400

    existing = _generated()
    if 0 <= idx < len(existing):
        existing.pop(idx)
        local_session[SESSION_KEY_GENERATED] = existing
        return jsonify({"success": True, "generated_questions": existing})
    return jsonify({"success": False, "error": "Question not found."}), 404


@ai.route("/ai_question_generator/api/delete_all", methods=["POST"])
@login_required
def ai_qgen_delete_all():
    """Clear all generated questions."""
    local_session[SESSION_KEY_GENERATED] = []
    return jsonify({"success": True, "generated_questions": []})


@ai.route("/ai_question_generator/api/extend", methods=["POST"])
@login_required
def ai_qgen_extend():
    """Extend one question's answer with the AI.

    The question being extended may be a generated one still in the working list
    (`index`), one already in the database (`question_id`), or one being written
    and not yet saved (neither). Only where the result is kept differs, so all
    three answer with the extended draft under `question`.
    """
    data = request.get_json() or {}
    incoming = _as_draft(data.get("question") or {})
    custom_instructions = (data.get("custom_instructions") or "").strip()
    options = data.get("options") if isinstance(data.get("options"), list) else []

    index = data.get("index")
    question_id = data.get("question_id")

    generated = _generated()
    if index is not None and not (
        isinstance(index, int) and 0 <= index < len(generated)
    ):
        return jsonify({"success": False, "error": "Question not found."}), 404

    saved = None
    if question_id is not None:
        saved = db_session.query(question).filter_by(question_id=question_id).first()
        if saved is None:
            return jsonify({"success": False, "error": "Question not found."}), 404

    try:
        extended = _extend_one(incoming, custom_instructions, options)
    except AIConfigError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        logging.exception("Extend failed")
        return jsonify({"success": False, "error": f"Extend failed: {e}"}), 500

    if index is not None:
        generated[index] = extended
        local_session[SESSION_KEY_GENERATED] = generated
    elif saved is not None:
        saved.answer = extended["answer"]
        saved.hint = extended["hint"] or None
        db_session.commit()

    return jsonify({"success": True, "question": extended})


@ai.route("/ai_question_generator/api/extend-options", methods=["GET"])
@login_required
def ai_qgen_extend_options():
    """Return the UI labels for the extend-model checkboxes."""
    return jsonify({
        "success": True,
        "options": [{"key": o["key"], "label": o["label"]} for o in EXTEND_OPTIONS],
    })

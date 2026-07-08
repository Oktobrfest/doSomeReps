"""AI Question Generator page.

Lets a user paste source material ("quiz content"), pick a desired
question-count range, and have the AI generate a batch of basic
question/answer pairs about it. Generated questions are rendered as
editable form-groups; the user can tweak them in place and then Save
(persist to DB) or Delete (drop from the working list).

A second, optional AI call generates hints for difficult questions
when the user ticks "Try to provide hints".
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from flask import (
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session as local_session,
    url_for,
)
from flask_login import current_user, login_required
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.sql import func

from repz.ai.prompts import (
    BASE_EXTEND_PROMPT,
    EXTEND_OPTIONS,
    build_extend_instructions,
)
from repz.routes import ai

from ..bluehelpers import (
    create_brand_new_quizq,
    get_all_categories,
    get_session,
    remove_underscore,
    set_session,
)
from ..database import session as db_session
from ..models import category, question
from .litellm_client import AIConfigError, completion_for_user
from .question_generator_forms import AIQuestionGenForm
from .question_pipeline import generate_questions, generate_hints


# Session key holding the current batch of AI-generated questions
# (a list of dicts). Stored as plain JSON-serializable dicts so the
# Flask session backend doesn't need to know about Pydantic.
SESSION_KEY_GENERATED = "ai_qgen_generated_questions"



# --- Pydantic schema for the AI response -----------------------------
class GeneratedQA(BaseModel):
    question: str = Field(..., description="The quiz question text.")
    answer: str = Field(..., description="A short, factual answer.")
    # `min_length=1` enforces "each question must have at least one
    # category" at the schema level, so providers that honor JSON
    # Schema constraints will refuse to emit a Q&A with zero tags.
    categories: List[str] = Field(
        ...,
        min_length=1,
        description=(
            "One or more categories chosen from the user-selected list. "
            "Must contain at least one entry; never empty."
        ),
    )
    # Hints are NOT produced by the question-generation call. They
    # are populated later from a separate hint-generation call (see
    # `HINT_GENERATION_PROMPT_TEMPLATE` / `GeneratedHintSet`) and only
    # when the user opts in via the "Try to provide hints" checkbox.
    # Always optional; null means "no hint warranted".
    hint: Optional[str] = Field(
        default=None,
        description=(
            "Optional study hint. Only set by the separate hint-generation "
            "call, and only when the question is difficult enough to warrant "
            "a hint. Null otherwise."
        ),
    )


class GeneratedQuestionSet(BaseModel):
    questions: List[GeneratedQA]


class GeneratedHint(BaseModel):
    """One hint slot, paired by index to an input question.

    `hint` is null when the model decides the question doesn't
    warrant a hint.
    """

    hint: Optional[str] = Field(
        default=None,
        description="Hint text, or null if no hint is warranted.",
    )


class GeneratedHintSet(BaseModel):
    hints: List[GeneratedHint]


class ExtendedAnswer(BaseModel):
    """Structured response for a single "Extend" call.

    The route assembles `short_answer` + `long_answer` back into the
    SHORT ANSWER / LONG ANSWER text format used in the answer field.
    `hint` is optional - the model only fills it in when it thinks a
    hint would meaningfully help.
    """

    short_answer: str = Field(
        ..., description="A concise summary answer (1-2 sentences)."
    )
    long_answer: str = Field(
        ...,
        description=(
            "A detailed, explanatory answer. Multiple paragraphs allowed; "
            "keep on-topic and within the question's category."
        ),
    )
    hint: Optional[str] = Field(
        default=None,
        description=(
            "Optional hint - only set when a hint would materially help "
            "a learner approach the question. Null otherwise."
        ),
    )


# --- Helpers ---------------------------------------------------------

# Some providers wrap structured output in ```json ... ``` fences even
# when asked for raw JSON; this strips a single surrounding fence if
# present so `model_validate_json` won't choke on it.
_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```$", re.DOTALL)


def _extract_message_content(resp: Any) -> str:
    """Pull the assistant message text out of a LiteLLM response."""
    try:
        return resp["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        # litellm.ModelResponse also supports attribute access
        return getattr(
            getattr(getattr(resp.choices[0], "message", None), "content", "") or "",
            "__str__",
            lambda: "",
        )()


def _strip_json_fence(content: str) -> str:
    content = (content or "").strip()
    m = _JSON_FENCE_RE.match(content)
    if m:
        return m.group(1).strip()
    return content


def _parse_question_set(resp: Any) -> GeneratedQuestionSet:
    raw = _strip_json_fence(_extract_message_content(resp))
    return GeneratedQuestionSet.model_validate_json(raw)


def _parse_hint_set(resp: Any) -> GeneratedHintSet:
    raw = _strip_json_fence(_extract_message_content(resp))
    return GeneratedHintSet.model_validate_json(raw)


def _parse_extended_answer(resp: Any) -> ExtendedAnswer:
    raw = _strip_json_fence(_extract_message_content(resp))
    try:
        return ExtendedAnswer.model_validate_json(raw)
    except Exception:
        # Some models may return the SHORT ANSWER / LONG ANSWER text
        # format instead of JSON despite response_format being set.
        # Parse the text format as a fallback.
        return _parse_text_extended_answer(raw)


_SHORT_ANSWER_RE = re.compile(
    r"^SHORT ANSWER:\s*\n(.*?)\n+\nLONG ANSWER:\s*\n(.*)",
    re.DOTALL,
)


def _parse_text_extended_answer(raw: str) -> ExtendedAnswer:
    """Parse a SHORT ANSWER / LONG ANSWER text response into ExtendedAnswer."""
    m = _SHORT_ANSWER_RE.match(raw.strip())
    if m:
        short = m.group(1).strip()
        long = m.group(2).strip()
        # Strip off any trailing hint section if present
        hint = None
        hint_match = re.search(r"\nHINT:\s*\n(.*)", long, re.DOTALL)
        if hint_match:
            long = long[: hint_match.start()].strip()
            hint = hint_match.group(1).strip()
        return ExtendedAnswer(short_answer=short, long_answer=long, hint=hint)
    # If we can't parse it, raise a clearer error
    raise ValueError(f"Could not parse extended answer: {raw[:200]!r}")


def _extend_one(
    item: Dict[str, Any],
    custom_instructions: str = "",
    selected_options: Optional[List[str]] = None,
) -> None:
    """Call the AI to extend a single question item in place.

    Updates `item["answer"]` with a SHORT ANSWER / LONG ANSWER layout,
    and overwrites `item["hint"]` only when the model produces one.
    Raises any underlying AI / parsing error to the caller.
    """
    cats = item.get("categories") or []
    cats_str = ", ".join(cats) if cats else "(general)"

    instr_block = build_extend_instructions(custom_instructions, selected_options)

    prompt = BASE_EXTEND_PROMPT.format(
        categories=cats_str,
        question=item.get("question", "") or "",
        current_answer=item.get("answer", "") or "",
        user_instructions_block=instr_block,
    )

    resp = completion_for_user(
        current_user,
        messages=[{"role": "user", "content": prompt}],
        response_format=ExtendedAnswer,
    )
    parsed = _parse_extended_answer(resp)

    # Re-emit the answer in the strict SHORT ANSWER / LONG ANSWER
    # layout so the editable answer textarea picks it up verbatim.
    item["answer"] = (
        "SHORT ANSWER:\n"
        + parsed.short_answer.strip()
        + "\n\nLONG ANSWER:\n"
        + parsed.long_answer.strip()
    )
    if parsed.hint:
        item["hint"] = parsed.hint.strip()


def _save_one_to_db(
    question_text: str,
    hint: Optional[str],
    answer: str,
    cat_names: List[str],
    uid: int,
    privacy: bool = False,
    auto_que: bool = False,
) -> bool:
    """Persist a single generated question to the DB.

    Returns True on success. Flashes an error and returns False on any
    validation problem (mirrors the rules used by `home.addcontent`).
    """
    question_text = (question_text or "").strip()
    answer = (answer or "").strip()
    hint = (hint or "").strip() or None

    if len(question_text) < 3:
        flash(
            f"Question text too short, skipped: {question_text[:30]!r}",
            category="error",
        )
        return False
    if len(answer) < 1:
        flash(
            f"Answer is required, skipped: {question_text[:30]!r}",
            category="error",
        )
        return False
    if not cat_names:
        flash(
            f"At least one category is required, skipped: {question_text[:30]!r}",
            category="error",
        )
        return False

    # Match `addcontent`'s length truncation rules.
    if len(question_text) > 1499:
        question_text = question_text[:1499]
    if hint and len(hint) > 1999:
        hint = hint[:1999]
    if len(answer) > 3999:
        answer = answer[:3999]

    # Skip duplicates (same as `addcontent`).
    existing = db_session.execute(
        select(question).where(question.question_text == question_text)
    ).first()
    if existing is not None:
        flash(
            f"Already exists, skipped: {question_text[:30]!r}",
            category="error",
        )
        return False

    new_q = question(
        question_text=question_text,
        hint=hint,
        answer=answer,
        created_on=func.now(),
        created_by=uid,
        privacy=privacy,
    )

    # The AI was given underscored category names from the form, so it
    # may return them in either underscored or spaced form. The DB
    # stores spaced names, so normalize to spaced before lookup.
    spaced_cats = [remove_underscore(c).strip() for c in cat_names]
    for cat_name in spaced_cats:
        cat_obj = db_session.execute(
            select(category).where(category.category_name == cat_name)
        ).scalar_one_or_none()
        if cat_obj is None:
            logging.warning(
                "AI Question Generator: unknown category %r, skipped tag", cat_name
            )
            continue
        new_q.categories.append(cat_obj)

    db_session.add(new_q)
    db_session.commit()

    if auto_que:
        create_brand_new_quizq([new_q.question_id], uid)

    return True


def _read_edited_item(form, idx: int) -> Dict[str, Any]:
    """Pull the user-edited values for question N out of the POST."""
    return {
        "question": (form.get(f"gen_question_{idx}", "") or "").strip(),
        "hint": (form.get(f"gen_hint_{idx}", "") or "").strip(),
        "answer": (form.get(f"gen_answer_{idx}", "") or "").strip(),
        "categories": form.getlist(f"gen_categories_{idx}"),
        # HTML checkboxes are absent from the form payload when
        # unchecked and present (value "on") when checked, matching
        # the convention used on the Add Content page.
        "privacy": form.get(f"gen_privacy_{idx}") == "on",
        "auto_que": form.get(f"gen_auto_que_{idx}") == "on",
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
    generated_questions = list(local_session.get(SESSION_KEY_GENERATED, []))
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
            )

        local_session[SESSION_KEY_GENERATED] = generated
        return jsonify({
            "success": True,
            "generated_questions": generated,
            "selected_categories": selected_categories
        })
    except AIConfigError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        logging.exception("AI question generation failed")
        return jsonify({"success": False, "error": f"AI request failed: {e}"}), 500


@ai.route("/ai_question_generator/api/save", methods=["POST"])
@login_required
def ai_qgen_save_one():
    """Save a single generated question."""
    data = request.get_json() or {}
    try:
        idx = int(data.get("index"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Invalid index."}), 400

    existing = list(local_session.get(SESSION_KEY_GENERATED, []))
    if not (0 <= idx < len(existing)):
        return jsonify({"success": False, "error": "Question not found."}), 404

    item = data.get("question") or {}
    q_text = (item.get("question") or "").strip()
    hint = (item.get("hint") or "").strip() or None
    answer = (item.get("answer") or "").strip()
    categories = item.get("categories") or []
    privacy = bool(item.get("privacy", False))
    auto_que = bool(item.get("auto_que", False))

    if not q_text or not answer:
        return jsonify({"success": False, "error": "Question and answer text are required."}), 400

    UID = current_user.id
    if _save_one_to_db(
        q_text,
        hint,
        answer,
        categories,
        UID,
        privacy=privacy,
        auto_que=auto_que,
    ):
        existing.pop(idx)
        local_session[SESSION_KEY_GENERATED] = existing
        return jsonify({
            "success": True,
            "generated_questions": existing
        })
    else:
        return jsonify({"success": False, "error": "Failed to save question to database."}), 500


@ai.route("/ai_question_generator/api/save_all", methods=["POST"])
@login_required
def ai_qgen_save_all():
    """Save all generated questions."""
    data = request.get_json() or {}
    items = data.get("questions") or []

    existing = list(local_session.get(SESSION_KEY_GENERATED, []))
    if not existing:
        return jsonify({"success": False, "error": "No questions to save."}), 400

    UID = current_user.id
    saved = 0
    kept = []

    for i, item in enumerate(items):
        if i >= len(existing):
            break
        q_text = (item.get("question") or "").strip()
        hint = (item.get("hint") or "").strip() or None
        answer = (item.get("answer") or "").strip()
        categories = item.get("categories") or []
        privacy = bool(item.get("privacy", False))
        auto_que = bool(item.get("auto_que", False))

        if q_text and answer and _save_one_to_db(
            q_text,
            hint,
            answer,
            categories,
            UID,
            privacy=privacy,
            auto_que=auto_que,
        ):
            saved += 1
        else:
            kept.append({
                "question": q_text,
                "hint": hint,
                "answer": answer,
                "categories": categories,
            })

    local_session[SESSION_KEY_GENERATED] = kept
    return jsonify({
        "success": True,
        "saved_count": saved,
        "generated_questions": kept
    })


@ai.route("/ai_question_generator/api/delete", methods=["POST"])
@login_required
def ai_qgen_delete_one():
    """Delete a single generated question from the working list."""
    data = request.get_json() or {}
    try:
        idx = int(data.get("index"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Invalid index."}), 400

    existing = list(local_session.get(SESSION_KEY_GENERATED, []))
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
def ai_qgen_extend_one():
    """Extend a single generated or saved question's answer using AI."""
    data = request.get_json() or {}

    try:
        idx = int(data["index"]) if data.get("index") is not None else None
    except (TypeError, ValueError):
        idx = None

    question_id_raw = data.get("question_id")
    question_id = None
    if isinstance(question_id_raw, int):
        question_id = question_id_raw
    elif isinstance(question_id_raw, str) and question_id_raw.isdigit():
        question_id = int(question_id_raw)

    custom_instructions = (
        data.get("custom_instructions") or data.get("extend_text") or ""
    ).strip()
    selected_options = (
        data.get("options") if isinstance(data.get("options"), list) else []
    )

    if idx is not None:
        existing = list(local_session.get(SESSION_KEY_GENERATED, []))
        if not (0 <= idx < len(existing)):
            return jsonify({"success": False, "error": "Question not found."}), 404

        # Fetch updated question details from user's edit
        item = data.get("question") or {}
        existing[idx]["question"] = (item.get("question") or "").strip()
        existing[idx]["hint"] = (item.get("hint") or "").strip() or None
        existing[idx]["answer"] = (item.get("answer") or "").strip()
        existing[idx]["categories"] = item.get("categories") or []
        existing[idx]["privacy"] = bool(item.get("privacy", False))
        existing[idx]["auto_que"] = bool(item.get("auto_que", False))

        try:
            _extend_one(existing[idx], custom_instructions, selected_options)
            local_session[SESSION_KEY_GENERATED] = existing
            return jsonify({"success": True, "generated_questions": existing})
        except AIConfigError as e:
            return jsonify({"success": False, "error": str(e)}), 400
        except Exception as e:
            logging.exception("Extend failed")
            return jsonify({"success": False, "error": f"Extend failed: {e}"}), 500

    if question_id is not None:
        q = db_session.query(question).filter_by(question_id=question_id).first()
        if not q:
            return jsonify({"success": False, "error": "Question not found."}), 404

        incoming = data.get("question") or {}
        working = {
            "question": (incoming.get("question") or "").strip() or q.question_text,
            "answer": (incoming.get("answer") or "").strip() or q.answer,
            "hint": (incoming.get("hint") or "").strip() or q.hint,
            "categories": incoming.get("categories")
            or [c.category_name for c in q.categories],
        }

        try:
            _extend_one(working, custom_instructions, selected_options)
        except AIConfigError as e:
            return jsonify({"success": False, "error": str(e)}), 400
        except Exception as e:
            logging.exception("Extend failed")
            return jsonify({"success": False, "error": f"Extend failed: {e}"}), 500

        q.answer = working["answer"]
        q.hint = working["hint"] or None
        db_session.commit()

        return jsonify({
            "success": True,
            "question": {
                "id": q.question_id,
                "question_text": q.question_text,
                "answer": q.answer,
                "hint": q.hint,
                "categories": [c.category_name for c in q.categories],
                "privacy": q.privacy,
            },
        })

    return jsonify({"success": False, "error": "Invalid request: provide 'index' or 'question_id'."}), 400


@ai.route("/ai_question_generator/api/extend-options", methods=["GET"])
@login_required
def ai_qgen_extend_options():
    """Return the UI labels for the extend-model checkboxes."""
    return jsonify({
        "success": True,
        "options": [{"key": o["key"], "label": o["label"]} for o in EXTEND_OPTIONS],
    })


@ai.route("/ai_question_generator/api/extend_all", methods=["POST"])
@login_required
def ai_qgen_extend_all():
    """Extend all generated questions' answers using AI."""
    data = request.get_json() or {}
    items = data.get("questions") or []

    existing = list(local_session.get(SESSION_KEY_GENERATED, []))
    if not existing:
        return jsonify({"success": False, "error": "No questions to extend."}), 400

    extended = 0
    errors = []

    for i, item in enumerate(items):
        if i >= len(existing):
            break

        # Pull latest edited values from frontend
        existing[i]["question"] = (item.get("question") or "").strip()
        existing[i]["hint"] = (item.get("hint") or "").strip() or None
        existing[i]["answer"] = (item.get("answer") or "").strip()
        existing[i]["categories"] = item.get("categories") or []
        existing[i]["privacy"] = bool(item.get("privacy", False))
        existing[i]["auto_que"] = bool(item.get("auto_que", False))

        instr = (item.get("extend_text") or "").strip()
        try:
            _extend_one(existing[i], instr)
            extended += 1
        except AIConfigError as e:
            errors.append(f"Config error: {e}")
            break  # config error affects all, bail out
        except Exception as e:
            logging.exception("Extend-all failed on item %d", i)
            errors.append(f"Extend failed for question #{i + 1}: {e}")

    local_session[SESSION_KEY_GENERATED] = existing
    return jsonify({
        "success": len(errors) == 0,
        "extended_count": extended,
        "generated_questions": existing,
        "errors": errors
    })

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


# Session key holding the current batch of AI-generated questions
# (a list of dicts). Stored as plain JSON-serializable dicts so the
# Flask session backend doesn't need to know about Pydantic.
SESSION_KEY_GENERATED = "ai_qgen_generated_questions"


# --- Prompt template -------------------------------------------------
#
# The user-supplied "quiz content" is appended to the END of this
# template before being sent to the AI. The selected categories are
# also injected so the AI can tag generated questions appropriately.
QUESTION_GENERATION_PROMPT_TEMPLATE = """\
You are an assistant that creates short, basic study questions and
answers from supplied source material, for use in a spaced-repetition
quiz app.

Generate between {qty_from} and {qty_to} question/answer pairs total.

Each question should:
- Be short, clear, and self-contained.
- Have a brief, factual answer (one or two sentences). The user will
  later be able to ask you to "extend" any answer into a longer,
  more in-depth explanation, so keep these initial answers compact.
- Be tagged with one or more categories from the user-selected list
  below. EVERY generated question MUST include at least one category
  from that list (never zero). A question can have multiple
  categories when more than one applies. You decide which of the
  user-selected categories best fit each question. Do NOT invent new
  categories or use any value outside the user-selected list.

User-selected categories (choose one or more for each question, from
this list only): {categories}

Source material follows below. Generate questions strictly about this
material:

---
"""


# --- Hint generation prompt template --------------------------------
#
# Used ONLY when the user ticks the "Try to provide hints" checkbox.
# This is sent as a SEPARATE AI call after the question-generation
# call: it takes the previously-generated questions as input and asks
# the model to write hints for the ones that are difficult enough to
# warrant a hint. Easy/obvious questions should be returned with no
# hint (null), so we don't clutter trivial questions with redundant
# nudges.
#
# The list of questions (a JSON dump of the first call's output) is
# appended to the END of this template before sending.
HINT_GENERATION_PROMPT_TEMPLATE = """\
You are an assistant that writes optional study hints for quiz
questions in a spaced-repetition app. You will be given a list of
questions (with their answers) that were generated previously.

For each question, decide whether the question is difficult enough
that a hint would actually help a learner who is stuck. ONLY produce
a hint when the question warrants one - if a question is easy,
straightforward, or its answer is obvious from the wording, return
no hint (null) for that item.

When you do produce a hint:
- Keep it short (one sentence is ideal).
- Nudge the learner toward the answer without giving the answer
  away outright.
- Do not restate the answer or include the answer text verbatim.

Return one hint entry per input question, in the same order as the
input, so they can be matched up by position.

Questions to consider follow below (JSON):

---
"""


# --- Extend (per-question deeper-answer) prompt template ------------
#
# Used by the "Extend" / "Extend All" buttons on the Generated
# Questions section. Each call expands one question's answer into a
# more thorough, explanatory version while staying inside the
# question's existing topic/category. The user may optionally add
# free-text instructions in the "extend instructions" field next to
# the Extend button; those are interpolated into
# `{user_instructions_block}` (or it stays empty when none were
# supplied).
#
# The model is asked to return its result in a strict two-section
# layout (SHORT ANSWER / LONG ANSWER) so we can drop it back into the
# editable answer textarea unchanged. A hint may also be returned if
# the model thinks one would help.
EXTEND_PROMPT_TEMPLATE = """\
You are extending an existing study question's answer into a more
detailed, explanatory version, for use in a spaced-repetition quiz
app. Stay focused on the question and the topic / category it sits
in - do NOT deviate into unrelated material.

The topic is {categories}.

Question:
{question}

Current answer:
{current_answer}
{user_instructions_block}
Write a more detailed, explanatory answer for the question above.
Stick to the question and the topic; do not wander outside that
category.

Format your output EXACTLY in the following layout. Keep spacing
TIGHT between paragraphs within a section. Put a single blank line
between distinct sub-sections where applicable. Use the literal
labels shown below:

SHORT ANSWER:
[A concise summary answer. One to two sentences.]

LONG ANSWER:
[A more detailed, explanatory answer. Multiple paragraphs are fine;
keep paragraph spacing tight. Use a blank line only between distinct
sub-sections within the long answer.]

Optionally, if a hint would meaningfully help a learner approach
this question, include one - otherwise leave the hint empty.
"""


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
    return ExtendedAnswer.model_validate_json(raw)


def _extend_one(item: Dict[str, Any], user_instructions: str) -> None:
    """Call the AI to extend a single generated-question item in place.

    Updates `item["answer"]` with a SHORT ANSWER / LONG ANSWER layout,
    and overwrites `item["hint"]` only when the model produces one.
    Raises any underlying AI / parsing error to the caller.
    """
    cats = item.get("categories") or []
    cats_str = ", ".join(cats) if cats else "(general)"

    instr_block = ""
    if user_instructions:
        # Surrounded by blank lines so it slots cleanly into the
        # template between "Current answer:" and the formatting rules.
        instr_block = (
            "\nAdditional user instructions for this extension:\n"
            f"{user_instructions}\n"
        )

    prompt = EXTEND_PROMPT_TEMPLATE.format(
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
    """Render the page; on POST dispatch on the clicked button's `action`."""
    form = AIQuestionGenForm()
    category_list = get_all_categories()
    UID = current_user.id

    action = request.form.get("action", "") if request.method == "POST" else ""

    # Categories selected via the shared categories.html partial come
    # in as repeated `category_name` form fields. Only the "generate"
    # action carries them; for the other actions we fall back to the
    # session-stored selection.
    if action == "generate":
        selected_categories = request.form.getlist("category_name")
        set_session("ai_qgen_category_names", selected_categories)
    else:
        selected_categories = get_session("ai_qgen_category_names")
        if selected_categories == "Not set":
            selected_categories = []

    # ---------- Action: generate ------------------------------------
    if action == "generate":
        if not form.validate_on_submit():
            flash("Please fix the form errors and try again.", category="error")
            return _render_page(form, category_list, selected_categories)

        if not selected_categories:
            flash(
                "Please select at least one category - the AI uses these "
                "to tag every generated question.",
                category="error",
            )
            return _render_page(form, category_list, selected_categories)

        # Build the prompt: template (with categories + range) followed
        # by the user's pasted material. We use spaced category names in
        # the prompt for better AI readability.
        spaced_cats = [remove_underscore(c) for c in selected_categories]
        prompt_header = QUESTION_GENERATION_PROMPT_TEMPLATE.format(
            qty_from=form.qty_from.data,
            qty_to=form.qty_to.data,
            categories=", ".join(spaced_cats),
        )
        full_prompt = prompt_header + (form.quiz_content.data or "")

        try:
            resp = completion_for_user(
                current_user,
                messages=[{"role": "user", "content": full_prompt}],
                response_format=GeneratedQuestionSet,
            )
            qset = _parse_question_set(resp)
            generated: List[Dict[str, Any]] = [q.model_dump() for q in qset.questions]

            # Optional second call: hints for the difficult questions.
            if form.try_provide_hints.data and generated:
                hint_payload = json.dumps(
                    [
                        {"question": g["question"], "answer": g["answer"]}
                        for g in generated
                    ],
                    indent=2,
                )
                hint_resp = completion_for_user(
                    current_user,
                    messages=[
                        {
                            "role": "user",
                            "content": HINT_GENERATION_PROMPT_TEMPLATE + hint_payload,
                        }
                    ],
                    response_format=GeneratedHintSet,
                )
                try:
                    hset = _parse_hint_set(hint_resp)
                    # Merge by index; ignore extras / shortfalls gracefully.
                    for i, h in enumerate(hset.hints[: len(generated)]):
                        if h.hint:
                            generated[i]["hint"] = h.hint
                except Exception as e:  # noqa: BLE001
                    logging.warning("Hint parse failed: %s", e)
                    flash(
                        "Hint generation returned an unexpected shape; "
                        "questions saved without hints.",
                        category="error",
                    )

            local_session[SESSION_KEY_GENERATED] = generated
            flash(
                f"Generated {len(generated)} question(s).",
                category="success",
            )
        except AIConfigError as e:
            flash(str(e), category="error")
        except Exception as e:  # noqa: BLE001 - surface any provider error
            logging.exception("AI question generation failed")
            flash(f"AI request failed: {e}", category="error")

        return redirect(url_for("ai.question_generator"))

    # ---------- Action: save:N or save_all --------------------------
    if action.startswith("save:") or action == "save_all":
        existing = list(local_session.get(SESSION_KEY_GENERATED, []))
        if not existing:
            flash("Nothing to save.", category="error")
            return redirect(url_for("ai.question_generator"))

        if action == "save_all":
            saved = 0
            kept: List[Dict[str, Any]] = []
            for i in range(len(existing)):
                edited = _read_edited_item(request.form, i)
                if _save_one_to_db(
                    edited["question"],
                    edited["hint"],
                    edited["answer"],
                    edited["categories"],
                    UID,
                    privacy=edited["privacy"],
                    auto_que=edited["auto_que"],
                ):
                    saved += 1
                else:
                    # Keep the un-saved one in the list so the user can
                    # fix it (e.g. duplicate / too short) and try again.
                    kept.append(
                        {
                            "question": edited["question"],
                            "hint": edited["hint"],
                            "answer": edited["answer"],
                            "categories": edited["categories"],
                        }
                    )
            local_session[SESSION_KEY_GENERATED] = kept
            if saved:
                flash(f"Saved {saved} question(s) to the database.", category="success")
        else:
            try:
                idx = int(action.split(":", 1)[1])
            except (ValueError, IndexError):
                flash("Bad save target.", category="error")
                return redirect(url_for("ai.question_generator"))

            if 0 <= idx < len(existing):
                edited = _read_edited_item(request.form, idx)
                if _save_one_to_db(
                    edited["question"],
                    edited["hint"],
                    edited["answer"],
                    edited["categories"],
                    UID,
                    privacy=edited["privacy"],
                    auto_que=edited["auto_que"],
                ):
                    existing.pop(idx)
                    local_session[SESSION_KEY_GENERATED] = existing
                    flash("Question saved.", category="success")
            else:
                flash("That question is no longer in the list.", category="error")

        return redirect(url_for("ai.question_generator"))

    # ---------- Action: delete:N or delete_all ----------------------
    if action.startswith("delete:") or action == "delete_all":
        if action == "delete_all":
            local_session[SESSION_KEY_GENERATED] = []
            flash("Cleared all generated questions.", category="success")
        else:
            try:
                idx = int(action.split(":", 1)[1])
            except (ValueError, IndexError):
                flash("Bad delete target.", category="error")
                return redirect(url_for("ai.question_generator"))

            existing = list(local_session.get(SESSION_KEY_GENERATED, []))
            if 0 <= idx < len(existing):
                existing.pop(idx)
                local_session[SESSION_KEY_GENERATED] = existing
                flash("Removed.", category="success")

        return redirect(url_for("ai.question_generator"))

    # ---------- Action: extend:N or extend_all ----------------------
    if action.startswith("extend:") or action == "extend_all":
        existing = list(local_session.get(SESSION_KEY_GENERATED, []))
        if not existing:
            flash("Nothing to extend.", category="error")
            return redirect(url_for("ai.question_generator"))

        if action == "extend_all":
            extended = 0
            for i in range(len(existing)):
                # Pick up any per-question "extend instructions" the
                # user typed into the text field next to the Extend
                # button before clicking Extend All.
                instr = (
                    request.form.get(f"gen_extend_text_{i}", "") or ""
                ).strip()
                try:
                    _extend_one(existing[i], instr)
                    extended += 1
                except AIConfigError as e:
                    # Config errors will affect every subsequent call,
                    # so bail out of the loop early.
                    flash(str(e), category="error")
                    break
                except Exception as e:  # noqa: BLE001
                    logging.exception("Extend-all failed on item %d", i)
                    flash(
                        f"Extend failed for question #{i + 1}: {e}",
                        category="error",
                    )
                    # Keep going with the remaining items.
            local_session[SESSION_KEY_GENERATED] = existing
            if extended:
                flash(
                    f"Extended {extended} answer(s).",
                    category="success",
                )
        else:
            try:
                idx = int(action.split(":", 1)[1])
            except (ValueError, IndexError):
                flash("Bad extend target.", category="error")
                return redirect(url_for("ai.question_generator"))

            if 0 <= idx < len(existing):
                instr = (
                    request.form.get(f"gen_extend_text_{idx}", "") or ""
                ).strip()
                try:
                    _extend_one(existing[idx], instr)
                    local_session[SESSION_KEY_GENERATED] = existing
                    flash("Answer extended.", category="success")
                except AIConfigError as e:
                    flash(str(e), category="error")
                except Exception as e:  # noqa: BLE001
                    logging.exception("Extend failed")
                    flash(f"Extend failed: {e}", category="error")
            else:
                flash(
                    "That question is no longer in the list.",
                    category="error",
                )

        return redirect(url_for("ai.question_generator"))

    # ---------- GET (or unknown POST) -------------------------------
    return _render_page(form, category_list, selected_categories)


def _render_page(form, category_list, selected_categories):
    """Common render path - pulls generated questions from the session."""
    generated_questions = list(local_session.get(SESSION_KEY_GENERATED, []))
    return render_template(
        "ai_question_generator.html",
        title="AI Question Generator",
        description="Have AI generate quiz questions from your material.",
        user=current_user,
        form=form,
        category_list=category_list,
        selected_categories=selected_categories,
        generated_questions=generated_questions,
    )

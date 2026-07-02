"""Pure AI question generation pipeline.

Extracts the context-free AI logic from question_generator.py so it can
be called from background workers or other non-Flask contexts.

Functions:
- generate_questions: Generate QA pairs from source text
- generate_hints: Generate hints for generated questions
"""
import json
import logging
from typing import Any, Dict, List

from pydantic import BaseModel, Field
from sqlalchemy import select

from ..bluehelpers import remove_underscore
from ..database import session as db_session
from ..models import users
from .litellm_client import AIConfigError, completion_for_user

logger = logging.getLogger(__name__)


# --- Prompt templates (verbatim from question_generator.py) -----------

QUESTION_GENERATION_PROMPT_TEMPLATE = """\
You are an assistant that creates short, basic study questions and
answers from supplied source material, for use in a spaced-repetition
quiz app.

Generate between {qty_from} and {qty_to} question/answer pairs total.

Each question should:
- Be short, clear, and self-contained. The person answering these
  questions will NOT have access to the source material, so every
  question must stand entirely on its own.
- NEVER reference the source material itself. Do not use phrases like
  "According to the text", "Based on the provided material", "In the
  article", "As shown in the document", or any similar wording.
- NEVER reference specific locations or identifiers from the source
  material. Do not use cross-references like "See equation (2.5)",
  "as described in Chapter 3", "refer to Figure 4", "in the example
  above", "per the preceding paragraph", or anything similar. If
  something from the source is needed in the question (e.g. a
  formula, a definition, a specific data point), copy that content
  directly into the question text instead of pointing the reader
  elsewhere.
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
material (but write them as self-contained questions that never mention
or reference the source material itself):

---
"""

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


# --- Pydantic schemas (verbatim from question_generator.py) -----------

class GeneratedQA(BaseModel):
    question: str = Field(..., description="The quiz question text.")
    answer: str = Field(..., description="A short, factual answer.")
    categories: List[str] = Field(
        ...,
        min_length=1,
        description=(
            "One or more categories chosen from the user-selected list. "
            "Must contain at least one entry; never empty."
        ),
    )
    hint: str | None = Field(
        default=None,
        description=(
            "Optional study hint. Only set by the separate hint-generation "
            "call, and only when the question is difficult enough to warrant "
            "a hint. Null otherwise."
        ),
    )


class GeneratedQuestionSet(BaseModel):
    questions: List[GeneratedQA]


class GeneratedQAWithoutHint(BaseModel):
    question: str = Field(..., description="The quiz question text.")
    answer: str = Field(..., description="A short, factual answer.")
    categories: List[str] = Field(
        ...,
        min_length=1,
        description=(
            "One or more categories chosen from the user-selected list. "
            "Must contain at least one entry; never empty."
        ),
    )


class GeneratedQuestionSetWithoutHint(BaseModel):
    questions: List[GeneratedQAWithoutHint]


class GeneratedHint(BaseModel):
    """One hint slot, paired by index to an input question."""

    hint: str | None = Field(
        default=None,
        description="Hint text, or null if no hint is warranted.",
    )


class GeneratedHintSet(BaseModel):
    hints: List[GeneratedHint]


# --- Helpers (verbatim from question_generator.py) ---------------------

_JSON_FENCE_RE = __import__("re").compile(r"^```(?:json)?\s*\n?(.*?)\n?```$", __import__("re").DOTALL)


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


def _parse_question_set(resp: Any, response_format=GeneratedQuestionSet) -> Any:
    raw = _strip_json_fence(_extract_message_content(resp))
    return response_format.model_validate_json(raw)


def _parse_hint_set(resp: Any) -> GeneratedHintSet:
    raw = _strip_json_fence(_extract_message_content(resp))
    return GeneratedHintSet.model_validate_json(raw)


def _get_user_by_id(user_id: int):
    """Look up user by ID for AI API calls."""
    return db_session.execute(
        select(users).where(users.id == user_id)
    ).scalar_one_or_none()


# --- Public API ---------------------------------------------------------


def generate_questions(
    text: str,
    categories: List[str],
    qty_from: int,
    qty_to: int,
    user_id: int,
    try_hints: bool = False,
) -> List[Dict[str, Any]]:
    """Generate QA pairs from source text.

    Args:
        text: The source material text to generate questions from.
        categories: List of category names to tag questions with.
        qty_from: Minimum number of questions to generate.
        qty_to: Maximum number of questions to generate.
        user_id: The user's ID (used to look up their AI config).
        try_hints: Whether hints should be generated in the schema.

    Returns:
        List of question dicts (each with 'question', 'answer', 'categories',
        and 'hint': None keys).

    Raises:
        AIConfigError: If the user hasn't configured their AI provider/model.
        Exception: Any other error from the AI provider.
    """
    user = _get_user_by_id(user_id)
    if user is None:
        raise ValueError(f"User {user_id} not found")

    # Build the prompt: template (with categories + range) followed
    # by the user's pasted material. We use spaced category names in
    # the prompt for better AI readability.
    spaced_cats = [remove_underscore(c) for c in categories]
    prompt_header = QUESTION_GENERATION_PROMPT_TEMPLATE.format(
        qty_from=qty_from,
        qty_to=qty_to,
        categories=", ".join(spaced_cats),
    )
    full_prompt = prompt_header + (text or "")

    logger.info("Generating %d-%d questions for user %d (try_hints=%s)", qty_from, qty_to, user_id, try_hints)

    fmt = GeneratedQuestionSet if try_hints else GeneratedQuestionSetWithoutHint
    resp = completion_for_user(
        user,
        messages=[{"role": "user", "content": full_prompt}],
        response_format=fmt,
    )
    qset = _parse_question_set(resp, response_format=fmt)
    generated: List[Dict[str, Any]] = [q.model_dump() for q in qset.questions]

    if not try_hints:
        for q in generated:
            q["hint"] = None

    logger.info("Generated %d questions for user %d", len(generated), user_id)
    return generated


def generate_hints(
    questions: List[Dict[str, Any]],
    user_id: int,
) -> List[Dict[str, Any]]:
    """Generate hints for previously generated questions.

    Mutates the input list in-place: adds 'hint' to each question dict
    where the model returned a hint. Questions that don't warrant a hint
    keep hint=None.

    Args:
        questions: List of question dicts with 'question' and 'answer' keys.
        user_id: The user's ID (used to look up their AI config).

    Returns:
        The same questions list, with hints filled in where appropriate.
    """
    if not questions:
        return questions

    user = _get_user_by_id(user_id)
    if user is None:
        raise ValueError(f"User {user_id} not found")

    # Build hint payload
    hint_payload = json.dumps(
        [
            {"question": q["question"], "answer": q["answer"]}
            for q in questions
        ],
        indent=2,
    )

    logger.info("Generating hints for %d questions for user %d", len(questions), user_id)

    hint_resp = completion_for_user(
        user,
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
        for i, h in enumerate(hset.hints[: len(questions)]):
            if h.hint:
                questions[i]["hint"] = h.hint
    except Exception as e:
        logger.warning("Hint parse failed: %s", e)
        # Return questions as-is on failure - caller can handle

    logger.info("Hints generated for user %d", user_id)
    return questions

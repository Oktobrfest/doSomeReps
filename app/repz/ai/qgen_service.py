"""Service module for AI question generation, hint generation, and question extending.

Contains stateless functions that do not depend on Flask request or session context.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import select

from ..bluehelpers import remove_underscore
from ..database import session as db_session
from ..models import users
from .litellm_client import completion_for_user

logger = logging.getLogger(__name__)


# --- Prompt templates -------------------------------------------------

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


# --- Pydantic Schemas -------------------------------------------------

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
    """Structured response for a single "Extend" call."""
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


# --- Helper methods for parsing ---------------------------------------

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


def _parse_question_set(resp: Any) -> GeneratedQuestionSet:
    raw = _strip_json_fence(_extract_message_content(resp))
    return GeneratedQuestionSet.model_validate_json(raw)


def _parse_hint_set(resp: Any) -> GeneratedHintSet:
    raw = _strip_json_fence(_extract_message_content(resp))
    return GeneratedHintSet.model_validate_json(raw)


def _parse_extended_answer(resp: Any) -> ExtendedAnswer:
    raw = _strip_json_fence(_extract_message_content(resp))
    return ExtendedAnswer.model_validate_json(raw)


def _get_user_by_id(user_id: int):
    """Look up user by ID for AI API calls."""
    return db_session.execute(
        select(users).where(users.id == user_id)
    ).scalar_one_or_none()


# --- Core Stateless Service Functions ---------------------------------

def generate_quiz_questions(
    text: str,
    categories: List[str],
    qty_from: int,
    qty_to: int,
    user_id: int,
) -> GeneratedQuestionSet:
    """Generate QA pairs from source text.

    Args:
        text: The source material text to generate questions from.
        categories: List of category names to tag questions with.
        qty_from: Minimum number of questions to generate.
        qty_to: Maximum number of questions to generate.
        user_id: The user's ID (used to look up their AI config).

    Returns:
        GeneratedQuestionSet containing the questions.
    """
    user = _get_user_by_id(user_id)
    if user is None:
        raise ValueError(f"User {user_id} not found")

    spaced_cats = [remove_underscore(c) for c in categories]
    prompt_header = QUESTION_GENERATION_PROMPT_TEMPLATE.format(
        qty_from=qty_from,
        qty_to=qty_to,
        categories=", ".join(spaced_cats),
    )
    full_prompt = prompt_header + (text or "")

    logger.info("Generating %d-%d questions for user %d", qty_from, qty_to, user_id)

    resp = completion_for_user(
        user,
        messages=[{"role": "user", "content": full_prompt}],
        response_format=GeneratedQuestionSet,
    )
    return _parse_question_set(resp)


def generate_hints(
    questions: List[Dict[str, Any]],
    user_id: int,
) -> GeneratedHintSet:
    """Generate optional study hints for previously generated questions.

    Args:
        questions: List of question dicts with 'question' and 'answer' keys.
        user_id: The user's ID.

    Returns:
        GeneratedHintSet with corresponding hints matching the input indexes.
    """
    if not questions:
        return GeneratedHintSet(hints=[])

    user = _get_user_by_id(user_id)
    if user is None:
        raise ValueError(f"User {user_id} not found")

    hint_payload = json.dumps(
        [
            {"question": q.get("question") or "", "answer": q.get("answer") or ""}
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
    return _parse_hint_set(hint_resp)


def extend_question(
    question_text: str,
    current_answer: str,
    categories: List[str],
    user_instructions: str,
    user_id: int,
) -> ExtendedAnswer:
    """Extend a single question's answer into a more detailed version.

    Args:
        question_text: The original question text.
        current_answer: The original answer text.
        categories: Categories associated with this question.
        user_instructions: Optional instructions from the user to direct extension.
        user_id: The user's ID.

    Returns:
        ExtendedAnswer object.
    """
    user = _get_user_by_id(user_id)
    if user is None:
        raise ValueError(f"User {user_id} not found")

    cats_str = ", ".join(categories) if categories else "(general)"

    instr_block = ""
    if user_instructions:
        instr_block = (
            "\nAdditional user instructions for this extension:\n"
            f"{user_instructions}\n"
        )

    prompt = EXTEND_PROMPT_TEMPLATE.format(
        categories=cats_str,
        question=question_text,
        current_answer=current_answer,
        user_instructions_block=instr_block,
    )

    logger.info("Extending answer for question for user %d", user_id)

    resp = completion_for_user(
        user,
        messages=[{"role": "user", "content": prompt}],
        response_format=ExtendedAnswer,
    )
    return _parse_extended_answer(resp)

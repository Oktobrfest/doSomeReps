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

from repz.ai.prompts import (
    HINT_GENERATION_PROMPT_TEMPLATE,
    IDENTICAL_QUESTION_CONSTRAINT,
    QUESTION_GENERATION_PROMPT_TEMPLATE,
)

from ..bluehelpers import remove_underscore
from ..database import session as db_session
from .litellm_client import completion_for_user
from .qgen_service import (
    GeneratedHintSet,
    _get_user_by_id,
    _parse_hint_set,
    _parse_question_set,
)

logger = logging.getLogger(__name__)


# --- Pydantic schemas -------------------------------------------------
# Hints are never produced by the generation call; they come from the separate
# generate_hints pass below, so the generation schema has no hint field.
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


class GeneratedQuestionSet(BaseModel):
    questions: List[GeneratedQA]


def generate_questions(
    text: str,
    categories: List[str],
    qty_from: int,
    qty_to: int,
    user_id: int,
    try_hints: bool = False,
    avoid_duplicates: bool = False,
) -> List[Dict[str, Any]]:
    """Generate QA pairs from source text.

    Args:
        text: The source material text to generate questions from.
        categories: List of category names to tag questions with.
        qty_from: Minimum number of questions to generate.
        qty_to: Maximum number of questions to generate.
        user_id: The user's ID (used to look up their AI config).
        try_hints: Whether hints should be generated in the schema.
        avoid_duplicates: Whether to avoid generating duplicate questions.

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

    existing_clause = ""
    if avoid_duplicates:
        from ..models import question, category
        stmt = (
            select(question.question_text)
            .join(question.categories)
            .where(category.category_name.in_(categories))
            .where(question.created_by == user_id)
        )
        existing_questions = db_session.execute(stmt).scalars().all()

        if existing_questions:
            # slice to 140 chars max, and limit to 250 items
            processed_existing = []
            for q in existing_questions:
                q_stripped = q.strip()
                q_cropped = q_stripped[:140]
                processed_existing.append(q_cropped)

            limited_existing = processed_existing[:250]
            existing_clause = (
                "\n\nCRITICAL CONSTRAINT:\n" +
                IDENTICAL_QUESTION_CONSTRAINT
                + "\n".join(f"- {q}" for q in limited_existing)
            )

    # Build the prompt: template (with categories + range) followed
    # by the user's pasted material. We use spaced category names in
    # the prompt for better AI readability.
    spaced_cats = [remove_underscore(c) for c in categories]
    prompt_header = QUESTION_GENERATION_PROMPT_TEMPLATE.format(
        qty_from=qty_from,
        qty_to=qty_to,
        categories=", ".join(spaced_cats),
    )
    full_prompt = prompt_header + (text or "") + existing_clause

    logger.info("Generating %d-%d questions for user %d (try_hints=%s)", qty_from, qty_to, user_id, try_hints)

    resp = completion_for_user(
        user,
        messages=[{"role": "user", "content": full_prompt}],
        response_format=GeneratedQuestionSet,
    )
    qset = _parse_question_set(resp, response_format=GeneratedQuestionSet)
    generated: List[Dict[str, Any]] = [q.model_dump() for q in qset.questions]

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

"""Schemas and response parsing for the AI question-generation calls.

The provider responses all arrive as JSON (sometimes fenced) that has to be
validated against a Pydantic model; this module owns those models and the
parsing, so the pipeline and the page routes share one definition of each.
"""

import re
from typing import Any, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import select

from ..database import session as db_session
from ..models import users



# --- Pydantic Schemas -------------------------------------------------

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


def _parse_question_set(resp: Any, response_format) -> Any:
    """Validate a question-set response against the caller's schema."""
    raw = _strip_json_fence(_extract_message_content(resp))
    return response_format.model_validate_json(raw)


def _parse_hint_set(resp: Any) -> GeneratedHintSet:
    raw = _strip_json_fence(_extract_message_content(resp))
    return GeneratedHintSet.model_validate_json(raw)


def _parse_extended_answer(resp: Any) -> ExtendedAnswer:
    raw = _strip_json_fence(_extract_message_content(resp))
    try:
        return ExtendedAnswer.model_validate_json(raw)
    except Exception:
        # Fallback: model returned SHORT ANSWER / LONG ANSWER text format.
        m = re.match(
            r"^SHORT ANSWER:\s*\n(.*?)\n+\nLONG ANSWER:\s*\n(.*)",
            raw.strip(),
            re.DOTALL,
        )
        if m:
            short = m.group(1).strip()
            long = m.group(2).strip()
            hint = None
            hint_match = re.search(r"\nHINT:\s*\n(.*)", long, re.DOTALL)
            if hint_match:
                long = long[: hint_match.start()].strip()
                hint = hint_match.group(1).strip()
            return ExtendedAnswer(short_answer=short, long_answer=long, hint=hint)
        raise ValueError(f"Could not parse extended answer: {raw[:200]!r}")


def _get_user_by_id(user_id: int):
    """Look up user by ID for AI API calls."""
    return db_session.execute(
        select(users).where(users.id == user_id)
    ).scalar_one_or_none()

"""Domain rules for authoring a question.

The add-content page, the AI question generator and the question editor are
three faces of one operation: writing a question. Field limits, category
resolution, duplicate detection and creation are written down here once, so
none of the three can drift from the others.
"""

import logging
from dataclasses import dataclass
from typing import Any, Collection, Mapping, Sequence

from sqlalchemy import select
from sqlalchemy.sql import func

from repz.bluehelpers import create_brand_new_quizq, get_rating, remove_underscore
from repz.database import session
from repz.home.form_helpers import PIC_PART_BY_TYPE, save_pictures
from repz.models import category, question, users
from repz.services.quiz_service import invalidate_quiz_queue_cache

# Mirrors the column widths on `question`. The editors enforce the same limits
# client-side, so a breach here means a stale or forged request.
MAX_QUESTION_TEXT = 1500
MAX_HINT = 2000
MAX_ANSWER = 4000

MIN_QUESTION_TEXT = 3
MIN_ANSWER = 1


class QuestionValidationError(ValueError):
    """A draft the author has to fix before it can be written."""


@dataclass(frozen=True)
class QuestionDraft:
    """One question as the editors post it, before it reaches the database."""

    question_text: str
    hint: str | None
    answer: str
    categories: tuple[str, ...]
    privacy: bool = False
    auto_que: bool = False

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any]) -> "QuestionDraft":
        """Read the JSON body every question editor posts."""
        return cls(
            question_text=(payload.get("question_text") or "").strip(),
            hint=(payload.get("hint") or "").strip() or None,
            answer=(payload.get("answer") or "").strip(),
            categories=tuple(payload.get("categories") or ()),
            privacy=bool(payload.get("privacy")),
            auto_que=bool(payload.get("auto_que")),
        )

    def validate(self) -> None:
        """Raise `QuestionValidationError` unless this draft is writable."""
        if len(self.question_text) < MIN_QUESTION_TEXT:
            raise QuestionValidationError("Question text is too short.")
        if len(self.question_text) > MAX_QUESTION_TEXT:
            raise QuestionValidationError(
                f"Question text cannot exceed {MAX_QUESTION_TEXT} characters."
            )
        if len(self.answer) < MIN_ANSWER:
            raise QuestionValidationError("An answer is required.")
        if len(self.answer) > MAX_ANSWER:
            raise QuestionValidationError(
                f"Answer cannot exceed {MAX_ANSWER} characters."
            )
        if self.hint and len(self.hint) > MAX_HINT:
            raise QuestionValidationError(f"Hint cannot exceed {MAX_HINT} characters.")


def question_payload(stored: question) -> dict[str, Any]:
    """A stored question in the shape `QuestionDraft.from_payload` reads.

    The editors load a question in this shape and the topic pages render it, so
    every page that shows one reads the same fields with the same images.
    """
    pics_by_type = {part: [] for part in PIC_PART_BY_TYPE.values()}
    for pic in stored.pics:
        part = PIC_PART_BY_TYPE.get(pic.pic_type)
        if part:
            pics_by_type[part].append({"pic_string": pic.pic_string, "pic_id": pic.pic_id})

    return {
        "id": stored.question_id,
        "question_text": stored.question_text,
        "hint": stored.hint,
        "answer": stored.answer,
        "categories": [c.category_name for c in stored.categories],
        "privacy": stored.privacy,
        "pics_by_type": pics_by_type,
    }


def que_listing(
    questions: Collection[question],
    favorites: Collection[int] = (),
    excluded: Collection[int] = (),
) -> list[dict[str, Any]]:
    """`questions` as the Que More cards show them: whole, with author and
    rating, and where the reader stands with each. A visitor stands nowhere,
    so leaves `favorites` and `excluded` out.
    """
    usernames = dict(session.execute(
        select(users.id, users.username)
        .where(users.id.in_({q.created_by for q in questions}))
    ).all())

    return [
        {
            **question_payload(q),
            "username": usernames[q.created_by],
            "created_by": q.created_by,
            "favorite": q.created_by in favorites,
            "rating": get_rating(q.question_id),
            "excluded": q.question_id in excluded,
        }
        for q in questions
    ]


def resolve_categories(names: Sequence[str]) -> list[category]:
    """Map posted category names onto their rows.

    Names travel underscored through older URLs and through AI output while the
    table stores them spaced, so they are normalised before lookup. An unknown
    name is an error rather than a silent drop: losing a tag without saying so
    is how a question ends up mis-filed.
    """
    wanted = {remove_underscore(name).strip() for name in names}
    wanted.discard("")
    if not wanted:
        raise QuestionValidationError("At least one category is required.")

    rows = (
        session.execute(select(category).where(category.category_name.in_(wanted)))
        .scalars()
        .all()
    )

    missing = sorted(wanted - {row.category_name for row in rows})
    if missing:
        raise QuestionValidationError(f"No such category: {', '.join(missing)}.")

    return list(rows)


def create_question(
    draft: QuestionDraft, *, created_by: int, files_request=None
) -> question:
    """Write a new question, with whatever images `files_request` carries.

    `files_request` is the Flask request holding the multipart upload; images
    arrive under the same field names `save_pictures` reads everywhere else.
    """
    draft.validate()
    categories = resolve_categories(draft.categories)

    duplicate = session.execute(
        select(question.question_id).where(
            question.question_text == draft.question_text
        )
    ).first()
    if duplicate is not None:
        raise QuestionValidationError("That question already exists.")

    new_question = question(
        question_text=draft.question_text,
        hint=draft.hint,
        answer=draft.answer,
        created_on=func.now(),
        created_by=created_by,
        privacy=draft.privacy,
    )
    new_question.categories = categories

    if files_request is not None:
        save_pictures(new_question, files_request)

    session.add(new_question)
    session.commit()

    logging.info("Question %s created by user %s", new_question.question_id, created_by)

    if draft.auto_que:
        create_brand_new_quizq([new_question.question_id], created_by)
        invalidate_quiz_queue_cache(created_by)

    return new_question


def apply_draft(existing: question, draft: QuestionDraft) -> None:
    """Write a draft onto a question that already exists. Caller commits."""
    draft.validate()
    existing.categories = resolve_categories(draft.categories)
    existing.question_text = draft.question_text
    existing.hint = draft.hint
    existing.answer = draft.answer
    existing.privacy = draft.privacy

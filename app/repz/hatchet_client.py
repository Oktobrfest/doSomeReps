"""
Shared Hatchet client used by the Flask app to trigger workflows.

Import and use `get_hatchet()` to get a singleton client, or call
`trigger_audio_generation(question_id, user_id)` directly.
"""

import logging
import os

from pydantic import BaseModel

from hatchet_sdk import Hatchet
from repz.ai.schema import QuestionGenInput, DocumentGenInput

logger = logging.getLogger(__name__)


class AudioGenerationInput(BaseModel):
    """Input schema for the generate_quiz_audio task."""

    question_id: int
    user_id: int

_hatchet: Hatchet | None = None
_generate_audio_task = None
_generate_questions_task = None
_generate_questions_from_doc_task = None


def get_hatchet() -> Hatchet:
    """Return a singleton Hatchet client."""
    global _hatchet
    if _hatchet is None:
        _hatchet = Hatchet()
        logger.info(
            "Hatchet client initialized: server=%s, grpc=%s",
            os.getenv("HATCHET_CLIENT_SERVER_URL", "<default>"),
            os.getenv("HATCHET_CLIENT_HOST_PORT", "<default>"),
        )
    return _hatchet


def _get_generate_audio_task():
    """Lazily create and return the standalone task for triggering."""
    global _generate_audio_task
    if _generate_audio_task is not None:
        return _generate_audio_task

    h = get_hatchet()

    @h.task(
        name="generate_quiz_audio",
        execution_timeout="5m",
        retries=2,
        input_validator=AudioGenerationInput,
    )
    def generate_quiz_audio(input: AudioGenerationInput, ctx) -> dict:
        # This stub is only used for triggering; the real logic is in
        # hatchet_workflow.py which runs as a separate worker process.
        raise NotImplementedError(
            "This stub should never be executed directly. "
            "The hatchet worker process runs the real implementation."
        )

    _generate_audio_task = generate_quiz_audio
    return _generate_audio_task


def _get_generate_questions_task():
    """Lazily create and return the standalone task for generating questions directly from text."""
    global _generate_questions_task
    if _generate_questions_task is not None:
        return _generate_questions_task

    h = get_hatchet()

    @h.task(
        name="generate_questions_workflow",
        execution_timeout="5m",
        retries=1,
        input_validator=QuestionGenInput,
    )
    def generate_questions_workflow(input: QuestionGenInput, ctx) -> dict:
        raise NotImplementedError(
            "This stub should never be executed directly. "
            "The hatchet worker process runs the real implementation."
        )

    _generate_questions_task = generate_questions_workflow
    return _generate_questions_task


def _get_generate_questions_from_doc_task():
    """Lazily create and return the standalone task for generating questions from document files."""
    global _generate_questions_from_doc_task
    if _generate_questions_from_doc_task is not None:
        return _generate_questions_from_doc_task

    h = get_hatchet()

    @h.task(
        name="generate_questions_from_doc_workflow",
        execution_timeout="10m",
        retries=1,
        input_validator=DocumentGenInput,
    )
    def generate_questions_from_doc_workflow(input: DocumentGenInput, ctx) -> dict:
        raise NotImplementedError(
            "This stub should never be executed directly. "
            "The hatchet worker process runs the real implementation."
        )

    _generate_questions_from_doc_task = generate_questions_from_doc_workflow
    return _generate_questions_from_doc_task


def trigger_question_generation(
    text_content: str,
    categories: list[str],
    qty_from: int,
    qty_to: int,
    user_id: int,
    try_hints: bool = False,
) -> list[dict]:
    """Trigger question generation from raw text on Hatchet and wait for results."""
    logger.info("Triggering question generation via Hatchet for user_id=%s", user_id)
    try:
        task = _get_generate_questions_task()
        result = task.run(
            input=QuestionGenInput(
                text_content=text_content,
                categories=categories,
                qty_from=qty_from,
                qty_to=qty_to,
                user_id=user_id,
                try_hints=try_hints,
            ),
            wait_for_result=True,
        )
        return result.get("questions", [])
    except Exception:
        logger.exception("Failed to run question generation workflow via Hatchet for user_id=%s", user_id)
        raise


def trigger_document_question_generation(
    document_path: str,
    document_type: str,
    categories: list[str],
    qty_from: int,
    qty_to: int,
    user_id: int,
    try_hints: bool = False,
) -> list[dict]:
    """Trigger question generation from a document on Hatchet and wait for results."""
    logger.info("Triggering document question generation via Hatchet for user_id=%s", user_id)
    try:
        task = _get_generate_questions_from_doc_task()
        result = task.run(
            input=DocumentGenInput(
                document_path=document_path,
                document_type=document_type,
                categories=categories,
                qty_from=qty_from,
                qty_to=qty_to,
                user_id=user_id,
                try_hints=try_hints,
            ),
            wait_for_result=True,
        )
        return result.get("questions", [])
    except Exception:
        logger.exception("Failed to run document question generation workflow via Hatchet for user_id=%s", user_id)
        raise


def trigger_audio_generation(question_id: int, user_id: int) -> None:
    """Fire-and-forget: trigger audio asset generation for a quiz question.

    Does not wait for completion. Errors are logged but not raised to the caller.
    """
    logger.info(
        "Preparing to dispatch audio generation for question_id=%s, user_id=%s",
        question_id,
        user_id,
    )
    try:
        task = _get_generate_audio_task()
        logger.info("Submitting task 'generate_quiz_audio' to Hatchet")
        task.run(
            input=AudioGenerationInput(question_id=question_id, user_id=user_id),
            wait_for_result=False,
        )
        logger.info(
            "Dispatched audio generation for question_id=%s, user_id=%s",
            question_id,
            user_id,
        )
    except Exception:
        logger.exception(
            "Failed to dispatch audio generation for question_id=%s, user_id=%s",
            question_id,
            user_id,
        )

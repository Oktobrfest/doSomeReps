"""
Hatchet worker for background audio asset generation.

Run this as a standalone process alongside the Flask app:

    python -m repz.hatchet_workflow

It listens for tasks triggered when a user adds questions to their quiz queue.
"""

import logging
import os
import sys
import tempfile
from pathlib import Path
from typing import Optional

from hatchet_sdk import Hatchet, Context

from repz.hatchet_client import AudioGenerationInput
from repz.ai.schema import QuestionGenInput, DocumentGenInput

logger = logging.getLogger(__name__)


def _log(input: str):
    """Helper to emit the same message to the local process stdout *and* Hatchet."""
    logger.info(input)
    return input


def _create_workflow():
    """Create and return the audio-generation hatchet task + hatchet client.

    Deferred so the Flask app context is available before we instantiate
    anything that touches the database or S3.
    """
    hatchet = Hatchet()

    @hatchet.task(
        name="generate_quiz_audio",
        execution_timeout="5m",
        retries=2,
        input_validator=AudioGenerationInput,
    )
    def generate_quiz_audio(input: AudioGenerationInput, ctx: Context) -> dict:
        """
        Generate TTS audio assets for a single quiz question.

        Input dict keys expected:
            question_id: int
            user_id: int
        """
        question_id = input.question_id
        user_id = input.user_id

        ctx.log(_log(f"Starting audio generation for question_id={question_id}, user_id={user_id}"))

        from repz import init_app

        app = init_app()

        with app.app_context():
            from flask import current_app
            from repz.database import session
            from repz.models import question, users, languages
            from repz.services.audio_asset_service import (
                AudioAssetService,
                S3StorageClient,
            )
            from repz.audio.create_audio import create_audio
            from sqlalchemy import select

            # ---- Resolve user and question from DB ----
            user = session.execute(
                select(users).where(users.id == user_id)
            ).scalar_one_or_none()

            if user is None:
                msg = f"User {user_id} not found"
                ctx.log(_log(msg))
                return {"status": "error", "message": msg}

            q_row = session.execute(
                select(question).where(question.question_id == question_id)
            ).scalar_one_or_none()

            if q_row is None:
                msg = f"Question {question_id} not found"
                ctx.log(_log(msg))
                return {"status": "error", "message": msg}

            # Build the dict expected by AudioAssetService
            q = {
                "question_id": q_row.question_id,
                "question_text": q_row.question_text,
                "hint": q_row.hint,
                "answer": q_row.answer,
            }

            # ---- Adapter: wraps create_audio to match the AudioAssetService interface ----

            class TTSClientAdapter:
                def __init__(self, piper_voices_dir=None):
                    self.piper_client = create_audio(voices_dir=piper_voices_dir)

                def create_audio(
                    self,
                    text: str,
                    language: str,
                    sentence_silence: Optional[float] = None,
                ) -> tuple[bytes, dict]:
                    language = language.replace("-", "_")

                    if language not in self.piper_client.DEFAULT_VOICES:
                        raise ValueError(f"Unsupported TTS language: {language}")

                    with tempfile.NamedTemporaryFile(
                        suffix=".mp3", delete=False
                    ) as temp_file:
                        temp_path = Path(temp_file.name)

                    try:
                        result = self.piper_client.create(
                            text=text,
                            output_path=temp_path,
                            language=language,
                            upload_to_s3=False,
                            overwrite=True,
                            sentence_silence=sentence_silence,
                        )

                        with open(result.path, "rb") as audio_file:
                            audio_bytes = audio_file.read()

                        metadata = {
                            "content_type": result.content_type,
                            "size_bytes": len(audio_bytes),
                            "duration_ms": None,
                            "tts_engine": "piper",
                            "tts_voice": result.voice,
                        }

                        return audio_bytes, metadata
                    finally:
                        temp_path.unlink(missing_ok=True)

            # ---- Run audio generation ----
            storage_client = S3StorageClient()
            tts_client = TTSClientAdapter()
            audio_service = AudioAssetService(tts_client, storage_client)

            try:
                result = audio_service.ensure_audio_for_quiz_question(
                    q=q,
                    user=user,
                    parts=("question", "answer", "hint"),
                )
                ctx.log(_log(
                    f"Audio generation complete for question_id={question_id}: {result}"
                ))
                return {"status": "success", "question_id": question_id, "assets": result}
            except Exception as e:
                ctx.log(_log(f"Audio generation failed for question_id={question_id}: {e}"))
                raise

    @hatchet.task(
        name="generate_questions_workflow",
        execution_timeout="5m",
        retries=1,
        input_validator=QuestionGenInput,
    )
    def generate_questions_workflow(input: QuestionGenInput, ctx: Context) -> dict:
        """Generate quiz questions from raw text."""
        ctx.log(_log(f"Starting question generation via Hatchet for user_id={input.user_id}"))
        from repz import init_app
        app = init_app()
        with app.app_context():
            from repz.ai.question_pipeline import generate_questions, generate_hints

            generated = generate_questions(
                text=input.text_content,
                categories=input.categories,
                qty_from=input.qty_from,
                qty_to=input.qty_to,
                user_id=input.user_id,
                try_hints=input.try_hints,
                avoid_duplicates=input.avoid_duplicates,
            )
            if input.try_hints:
                if generated:
                    try:
                        generate_hints(generated, input.user_id)
                    except Exception as e:
                        ctx.log(_log(f"Hint generation failed: {e}"))

            ctx.log(_log(f"Generated {len(generated)} questions via Hatchet for user_id={input.user_id}"))
            return {"questions": generated}

    @hatchet.task(
        name="generate_questions_from_doc_workflow",
        execution_timeout="10m",
        retries=0,
        input_validator=DocumentGenInput,
    )
    def generate_questions_from_doc_workflow(input: DocumentGenInput, ctx: Context) -> dict:
        """Generate quiz questions from PDF or image document files (downloaded from S3)."""
        ctx.log(_log(f"Starting document question generation via Hatchet for user_id={input.user_id}, s3_key={input.document_path}"))
        from repz import init_app
        app = init_app()
        with app.app_context():
            import tempfile
            import os
            from repz.ai.doc_processor import extract_text_from_pdf, extract_text_from_image
            from repz.ai.question_pipeline import generate_questions, generate_hints
            from repz.s3_ext import get_s3

            s3_key = input.document_path
            s3_client = get_s3()

            # Download file bytes from S3
            ctx.log(_log(f"Downloading document from S3: {s3_key}"))
            result = s3_client.get_object(s3_key)
            if result is None:
                msg = f"S3 object not found: {s3_key}"
                ctx.log(_log(msg))
                raise FileNotFoundError(msg)

            content_bytes, content_type = result
            ctx.log(_log(f"Downloaded {len(content_bytes)} bytes from S3"))

            # Determine extension from s3 key
            _, ext = os.path.splitext(s3_key)
            if not ext:
                ext = ".pdf" if input.document_type == "pdf" else ".png"

            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                    tmp.write(content_bytes)
                    tmp_path = tmp.name

                if input.document_type == "pdf":
                    text = extract_text_from_pdf(tmp_path)
                elif input.document_type in ("image", "png", "jpg", "jpeg"):
                    text = extract_text_from_image(tmp_path)
                else:
                    raise ValueError(f"Unsupported document type: {input.document_type}")
            finally:
                if tmp_path:
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass
                # Delete the temporary S3 object after processing
                try:
                    s3_client.delete_s3_object(s3_key)
                    ctx.log(_log(f"Deleted S3 object: {s3_key}"))
                except Exception as e:
                    ctx.log(_log(f"Warning: could not delete S3 object {s3_key}: {e}"))

            generated = generate_questions(
                text=text,
                categories=input.categories,
                qty_from=input.qty_from,
                qty_to=input.qty_to,
                user_id=input.user_id,
                try_hints=input.try_hints,
                avoid_duplicates=input.avoid_duplicates,
            )
            if input.try_hints:
                if generated:
                    try:
                        generate_hints(generated, input.user_id)
                    except Exception as e:
                        ctx.log(_log(f"Hint generation failed: {e}"))

            ctx.log(_log(f"Generated {len(generated)} questions from doc via Hatchet for user_id={input.user_id}"))
            return {"questions": generated}

    return hatchet, [generate_quiz_audio, generate_questions_workflow, generate_questions_from_doc_workflow]


def main():
    """Entry point for the hatchet worker process."""
    logging.basicConfig(level=logging.INFO)

    hatchet, tasks = _create_workflow()

    worker = hatchet.worker(
        name="AudioGenerationWorker",
        slots=4,
        workflows=tasks,
    )

    logger.info("Starting Hatchet worker: AudioGenerationWorker (listening for tasks)")
    worker.start()


if __name__ == "__main__":
    main()

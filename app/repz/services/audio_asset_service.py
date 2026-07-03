import hashlib
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.repz.ai.prompts import GENERATE_TTS_AUDIO_TEXT
from repz.database import session
from repz.models import audio
from repz.aws_s3 import S3
from repz.ai.litellm_client import completion_for_user


class S3StorageClient:
    """Storage client adapter that wraps S3 for use with AudioAssetService."""

    def __init__(self):
        from flask import current_app

        self.s3 = S3(current_app)

    def save(self, object_key: str, content: bytes, content_type: str) -> str:
        """Save content to S3 and return public URL.

        :param object_key: S3 object key
        :param content: File content as bytes
        :param content_type: MIME content type
        :return: Public URL to the uploaded file
        """
        import os
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            tmp_file.write(content)
            tmp_file_path = tmp_file.name

        try:
            extra_args = {
                "ContentType": content_type,
                "Metadata": {
                    "uploaded_by": "audio_asset_service",
                },
            }

            result = self.s3.upload_file_to_s3(
                file_name=tmp_file_path,
                ExtraArgs=extra_args,
                object_name=object_key,
            )

            if result:
                return result

            raise RuntimeError(f"Failed to upload {object_key} to S3")

        finally:
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)


class AudioAssetService:
    def __init__(self, tts_client, storage_client):
        self.tts_client = tts_client
        self.storage_client = storage_client

    def _sentence_silence_for_language(self, language: str) -> float:
        """Return Piper sentence silence in seconds by language."""
        lang = language.lower()

        if lang.startswith("es"):
            return 1.15
        if lang.startswith("ru"):
            return 0.40
        if lang.startswith("en"):
            return 0.2

        return 0.35

    def _default_tts_texts(self, q: dict) -> dict:
        """Return the default source text for each quiz part."""
        return {
            "question": q.get("question_text"),
            "answer": q.get("answer"),
            "hint": q.get("hint"),
        }

    def _can_generate_ai_tts_text(self, user) -> bool:
        """Return whether this user has enough AI config to generate TTS-friendly text."""
        has_provider = bool(getattr(user, "ai_provider", None))
        has_model = bool(getattr(user, "ai_model", None))
        has_key = bool(getattr(user, "ai_api_key", None))

        logging.info(
            "🤖 AI TTS config check: "
            f"provider={has_provider}, model={has_model}, api_key={has_key}"
        )

        return has_provider and has_model and has_key

    def _audio_object_key(
        self,
        question_id: int,
        part: str,
        language: str,
        source_text: str,
    ) -> str:
        """
        Build the deterministic audio object key.

        IMPORTANT:
        This intentionally keeps the existing cache behavior: the object key is
        based on the original source text, not the AI-generated TTS text.
        """
        text_hash = hashlib.sha256(source_text.encode("utf-8")).hexdigest()
        return f"audio/{language}/{question_id}/{part}-{text_hash}.mp3"

    def _get_existing_audio_url(self, object_key: str) -> str | None:
        """Return an existing audio URL/object key if this audio row already exists."""
        existing = session.execute(
            select(audio).where(audio.object_key == object_key)
        ).scalar_one_or_none()

        if existing is None:
            return None

        return str(existing.public_url or existing.object_key)

    def _language_tts_instruction(self, language: str) -> str:
        """Return language-specific TTS instructions."""
        if language.startswith("en"):
            return """The target language is English.
Rewrite the text to sound natural when spoken aloud.
"""

        lang_text = f"""Translate the text into the target language: {language}
        if it isn't already in that language.
Use the normal writing system for that language.
Make the translated text natural, fluent, and easy to understand when spoken aloud.
"""

        if language in ("es_ES", "es_MX", "en_ES") or language.startswith("es"):
            lang_text += """The target language is Spanish.
The output must be Spanish, not English.
Use natural Spanish punctuation and sentence boundaries.
Use commas and periods generously where they improve pacing.
Use opening question and exclamation marks when appropriate, such as ¿ and ¡.
Avoid overly long sentences.
Target this translation for a beginner Spanish speaker.
Avoid difficult rarely used words and jargon.
"""

        return lang_text

    def _resolve_tts_text_for_part(
        self,
        *,
        part: str,
        source_text: str,
        language: str,
        user,
    ) -> str:
        """
        Resolve the final text that should be spoken by TTS for one part.

        Rules:
        - If the user does not have AI config, fall back to source_text.
        - If the user has AI config, AI generation must succeed.
        - If AI generation fails, raise. Do not silently create bad audio.
        - TTS generation should only ever use the returned tts_text.
        """
        if not source_text:
            return source_text

        can_use_ai = self._can_generate_ai_tts_text(user)

        if not can_use_ai:
            logging.warning(
                f"AI TTS text generation unavailable for {part} in {language}; "
                f"falling back to source text because user AI config is incomplete."
            )
            return source_text

        logging.info(f"Generating TTS text for {part} in {language}")

        tts_text = self._generate_tts_text_for_part(
            part=part,
            source_text=source_text,
            language=language,
            user=user,
        )

        logging.info(
            f"✅ Resolved TTS text for {part} in {language}: "
            f"{tts_text[:120]}..."
        )

        return tts_text

    def _generate_tts_text_for_part(
        self,
        *,
        part: str,
        source_text: str,
        language: str,
        user,
    ) -> str:
        language_instruction = self._language_tts_instruction(language)

        prompt = GENERATE_TTS_AUDIO_TEXT.format(
            language_instruction=language_instruction,
            language=language,
            part=part,
            source_text=source_text
        )

        response: Any = completion_for_user(
            user,
            [{"role": "user", "content": prompt}],
            temperature=0.1,
        )

        content = response["choices"][0]["message"]["content"]

        if content is None:
            raise ValueError(f"AI returned no TTS text for {part} in {language}")

        tts_text = content.strip()

        if not tts_text:
            raise ValueError(f"AI returned empty TTS text for {part} in {language}")

        return tts_text


    def ensure_audio_for_quiz_question(
        self,
        q: dict,
        user,
        parts=("question", "answer"),
        language: str = "en_US",
    ) -> dict:
        """
        Audio generation is idempotent and separate from quiz progression.

        The language argument is kept for call compatibility, but audio is generated
        for every language attached to the user.
        """
        logging.info(
            f"🎵 ensure_audio_for_quiz_question called for "
            f"question_id={q.get('question_id')}, parts={parts}"
        )

        if not user.languages:
            from repz.models import languages
            default_lang = session.execute(
                select(languages).where(languages.language == language)
            ).scalar_one_or_none()
            if not default_lang:
                default_lang = languages(language=language)
                session.add(default_lang)
                session.flush()
            user.languages.append(default_lang)
            session.commit()

        assets_by_language = {}
        part_to_text = self._default_tts_texts(q)

        for lang_obj in user.languages:
            lang = lang_obj.language
            logging.info(f"Processing language: {lang}")

            assets_by_language[lang] = {}

            for part in parts:
                source_text = part_to_text.get(part)

                if not source_text:
                    logging.debug(f"Skipping {part} - no text")
                    continue

                object_key = self._audio_object_key(
                    question_id=q["question_id"],
                    part=part,
                    language=lang,
                    source_text=source_text,
                )

                existing_url = self._get_existing_audio_url(object_key)

                if existing_url is not None:
                    logging.info(f"Found existing audio for {part} in {lang}: {existing_url}")
                    assets_by_language[lang][part] = existing_url
                    continue

                tts_text = self._resolve_tts_text_for_part(
                    part=part,
                    source_text=source_text,
                    language=lang,
                    user=user,
                )

                logging.info(f"Ensuring audio for {part} in {lang}: {source_text[:80]}...")

                try:
                    asset_url = self.ensure_audio(
                        question_id=q["question_id"],
                        part=part,
                        language=lang,
                        source_text=source_text,
                        tts_text=tts_text,
                    )

                    assets_by_language[lang][part] = asset_url

                    logging.info(
                        f"✅ Successfully ensured audio for {part} "
                        f"in {lang}: {asset_url}"
                    )

                except Exception as e:
                    logging.error(f"❌ Failed to ensure audio for {part} in {lang}: {e}")
                    raise

        logging.info(f"audio_asset_service generated these assets: {assets_by_language}")
        return assets_by_language

    def ensure_audio(
        self,
        question_id: int,
        part: str,
        language: str,
        source_text: str,
        tts_text: str,
    ) -> str:
        """
        Ensure audio exists for a given question part, creating it if necessary.

        source_text controls the object key/cache identity.
        tts_text is the only text ever sent to the TTS engine.
        """
        object_key = self._audio_object_key(
            question_id=question_id,
            part=part,
            language=language,
            source_text=source_text,
        )

        logging.info(f"🔑 Looking for existing audio with object_key: {object_key}")

        existing = session.execute(
            select(audio).where(audio.object_key == object_key)
        ).scalar_one_or_none()

        if existing is not None:
            logging.info(
                f"Found existing audio, returning: "
                f"{existing.public_url or existing.object_key}"
            )
            return str(existing.public_url or existing.object_key)

        logging.info(f"No existing audio found, creating new audio for: {source_text[:80]}...")
        logging.info(f"TTS text for {part} in {language}: {tts_text[:200]}...")

        sentence_silence = self._sentence_silence_for_language(language)

        try:
            audio_bytes, metadata = self.tts_client.create_audio(
                text=tts_text,
                language=language,
                sentence_silence=sentence_silence,
            )
            logging.info(f"✅ TTS generated {len(audio_bytes)} bytes of audio")
        except Exception as e:
            logging.error(f"❌ TTS generation failed: {e}")
            raise

        try:
            public_url = self.storage_client.save(
                object_key=object_key,
                content=audio_bytes,
                content_type="audio/mpeg",
            )
            logging.info(f"Saved to S3, public URL: {public_url}")
        except Exception as e:
            logging.error(f"❌ S3 save failed: {e}")
            raise

        try:
            row = audio(
                question_id=question_id,
                part=part,
                audio_text=tts_text,
                object_key=object_key,
                public_url=public_url,
                content_type="audio/mpeg",
                size_bytes=metadata.get("size_bytes"),
                duration_ms=metadata.get("duration_ms"),
                tts_engine=metadata.get("tts_engine", "piper"),
                tts_voice=metadata.get("tts_voice"),
                language=language,
            )

            session.add(row)
            session.commit()
            logging.info("Saved to database successfully")

        except IntegrityError:
            logging.info("Concurrent creation detected, using existing record")
            session.rollback()

            existing = session.execute(
                select(audio).where(audio.object_key == object_key)
            ).scalar_one_or_none()

            if existing:
                return str(existing.public_url or existing.object_key)

            logging.error(
                f"❌ IntegrityError occurred but no existing record found for "
                f"{object_key}. This might be a ForeignKey violation or other constraint."
            )
            raise

        except Exception as e:
            logging.error(f"❌ Database save failed: {e}")
            session.rollback()
            raise

        return public_url

    def get_audio_content(self, audio_id: int):
        """Retrieve audio content from S3 by audio ID.

        :param audio_id: The audio record ID
        :return: Tuple of (content_bytes, content_type) if found, None if not found
        """
        audio_record = session.execute(
            select(audio).where(audio.audio_id == audio_id)
        ).scalar_one_or_none()

        if audio_record is None:
            return None

        from flask import current_app

        s3 = S3(current_app)
        result = s3.get_object(audio_record.object_key)

        if result is None:
            return None

        content, _ = result
        return content, audio_record.content_type

    def get_audio_by_object_key(self, object_key: str):
        """Retrieve audio content from S3 by object key.

        :param object_key: The S3 object key
        :return: Tuple of (content_bytes, content_type) if found, None if not found
        """
        audio_record = session.execute(
            select(audio).where(audio.object_key == object_key)
        ).scalar_one_or_none()

        if audio_record is None:
            return None

        from flask import current_app

        s3 = S3(current_app)
        result = s3.get_object(object_key)

        if result is None:
            return None

        content, _ = result
        return content, audio_record.content_type

    def get_audio_url(self, audio_id: int, use_direct_serving: bool = True):
        """Get the URL to access an audio file.

        :param audio_id: The audio record ID
        :param use_direct_serving: If True, return local serving URL, if False return S3 presigned URL
        :return: URL string if found, None if not found
        """
        audio_record = session.execute(
            select(audio).where(audio.audio_id == audio_id)
        ).scalar_one_or_none()

        if audio_record is None:
            return None

        if use_direct_serving:
            from flask import url_for

            return url_for("audio.serve_audio_file", audio_id=audio_id)

        from flask import current_app

        s3 = S3(current_app)
        return s3.generate_presigned_url(audio_record.object_key, expiration=3600)

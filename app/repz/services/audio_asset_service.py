import hashlib
import json
import logging
from typing import Optional, Any
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from repz.database import session
from repz.models import audio
from repz.aws_s3 import S3
from repz.ai.litellm_client import completion_for_user


class S3StorageClient:
    """Storage client adapter that wraps S3 for use with AudioAssetService"""

    def __init__(self):
        from flask import current_app
        self.s3 = S3(current_app)

    def save(self, object_key: str, content: bytes, content_type: str) -> str:
        """Save content to S3 and return public URL

        :param object_key: S3 object key
        :param content: File content as bytes
        :param content_type: MIME content type
        :return: Public URL to the uploaded file
        """
        # Write content to a temporary file
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            tmp_file.write(content)
            tmp_file_path = tmp_file.name

        try:
            # Upload to S3
            extra_args = {
                'ContentType': content_type,
                'Metadata': {
                    'uploaded_by': 'audio_asset_service'
                }
            }

            result = self.s3.upload_file_to_s3(
                file_name=tmp_file_path,
                ExtraArgs=extra_args,
                object_name=object_key
            )

            if result:
                return result  # This returns the public URL
            else:
                raise RuntimeError(f"Failed to upload {object_key} to S3")

        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)


class AudioAssetService:
    def __init__(self, tts_client, storage_client):
        self.tts_client = tts_client
        self.storage_client = storage_client

    def ensure_audio_for_quiz_question(self, q: dict, language: str, user, parts=("question", "answer")) -> dict:
        """Audio generation is idempotent and separate from quiz progression"""

        logging.info(f"🎵 ensure_audio_for_quiz_question called for question_id={q.get('question_id')}, parts={parts}")
        assets = {}

        # 1. Determine which parts actually need to be generated
        parts_to_generate = []
        part_to_text = {
            "question": q.get("question_text"),
            "answer": q.get("answer"),
            "hint": q.get("hint"),
        }

        for part in parts:
            text = part_to_text.get(part)
            if not text:
                continue

            text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            object_key = f"audio/{language}/{q['question_id']}/{part}-{text_hash}.mp3"

            existing = session.execute(
                select(audio).where(audio.object_key == object_key)
            ).scalar_one_or_none()

            if not existing:
                parts_to_generate.append(part)

        # 2. If any parts need generation, get TTS-friendly versions for the whole question
        tts_texts = {}
        if parts_to_generate:
            logging.info(f"🤖 Generating TTS-friendly text for parts: {parts_to_generate}")
            tts_texts = self._generate_tts_texts(q, language, user)

        # 3. Ensure audio for each part
        for part in parts:
            text = part_to_text.get(part)
            if not text:
                logging.debug(f"⏭️ Skipping {part} - no text")
                continue

            logging.info(f"🔊 Ensuring audio for {part}: {text[:50]}...")
            try:
                asset_url = self.ensure_audio(
                    question_id=q["question_id"],
                    part=part,
                    text=text,
                    language=language,
                    tts_text=tts_texts.get(part) if part in tts_texts else None
                )
                assets[part] = asset_url
                logging.info(f"✅ Successfully ensured audio for {part}: {asset_url}")
            except Exception as e:
                logging.error(f"❌ Failed to ensure audio for {part}: {e}")
                raise

        logging.info(f"🎧 Final assets: {assets}")
        return assets

    def _generate_tts_texts(self, q: dict, language: str, user) -> dict:
        """Generate TTS-friendly versions of question text using AI."""
        try:
            prompt = f"""
            You are an expert at preparing text for Text-to-Speech (TTS) systems.
            Your goal is to rewrite the provided quiz question parts (question, answer, hint) to be more natural, clear, and easy for a TTS engine to read.

            Target Language: {language}

            Original Question: {q.get('question_text', '')}
            Original Answer: {q.get('answer', '')}
            Original Hint: {q.get('hint', '')}

            Guidelines:
            1. Improve flow and naturalness of speech.
            2. Expand abbreviations that might be read incorrectly (e.g. "eg." to "for example", "st." to "street" or "saint").
            3. Use phonetic spellings for very difficult or ambiguous names if necessary.
            4. Keep the core meaning and facts exactly the same.
            5. If a part is missing or empty, return it as an empty string.
            6. There maybe formulas present, in those cases if the formula is too long and or complex you will need to omit it entirely,
            alternatively, rewrite the formula sections entirely so that a person just learning about this topic with no prior
            knowledge of the equation will be able to follow along. If you use even a single letter, greek or otherwise in any part of the formula,
            you must then repeat the complete forumla in its entirety using full language twice more, for a total of three times.
            So in for formulas you will do once with the letters only, once with the words only, and once more with both the letters and full words.
            So E=MC^2 will become: "E equals M times C squared, or energy equals mass times the speed of light squared. I repeat,
            E energy is equal to M mass times C the speed of light squared"
            7. Omit any dashes, formatting marks, section seperators, long strings of numbers, and the like so that the speech
            will flow smoothly and naturally.
            8. Correct any major factual inaccuracies or falsehoods if present, but do not get nit picky!
            9. Do not ever include more than three formulas TOPS and only if their short.
            10. Completely rewriting the text is perfectly acceptable if it provides a better listening experience, improves clarity,
            or you determine is appropriate.

            Return your response as a JSON object with keys "question", "answer", and "hint".
            Return ONLY the JSON object.
            """

            messages = [{"role": "user", "content": prompt}]
            # Use response_format if supported, otherwise just parse the text
            response: Any = completion_for_user(
                user,
                messages,
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            content = response["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception as e:
            logging.warning(f"⚠️ Failed to generate TTS friendly text via AI: {e}. Falling back to raw text.")
            return {
                "question": q.get("question_text"),
                "answer": q.get("answer"),
                "hint": q.get("hint")
            }

    def ensure_audio(self, question_id: int, part: str, text: str, language: str, tts_text: Optional[str] = None) -> str:
        """Ensure audio exists for a given question part, creating if necessary"""
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        object_key = f"audio/{language}/{question_id}/{part}-{text_hash}.mp3"

        logging.info(f"🔑 Looking for existing audio with object_key: {object_key}")

        existing = session.execute(
            select(audio).where(audio.object_key == object_key)
        ).scalar_one_or_none()

        if existing is not None:
            logging.info(f"♾️ Found existing audio, returning: {existing.public_url or existing.object_key}")
            return str(existing.public_url or existing.object_key)

        logging.info(f"🎵 No existing audio found, creating new audio for: {text[:30]}...")

        # Use provided tts_text if available, otherwise fallback to original text
        tts_to_use = tts_text or text
        logging.info(f"🗣️ TTS text to use: {tts_to_use[:50]}...")

        try:
            audio_bytes, metadata = self.tts_client.create_audio(
                text=tts_to_use,
                language=language,
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
            logging.info(f"☁️ Saved to S3, public URL: {public_url}")
        except Exception as e:
            logging.error(f"❌ S3 save failed: {e}")
            raise

        try:
            row = audio(
                question_id=question_id,
                part=part,
                audio_text=tts_to_use,
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
            logging.info(f"💾 Saved to database successfully")
        except IntegrityError:
            # Handles concurrent requests generating the same audio
            logging.info(f"🔄 Concurrent creation detected, using existing record")
            session.rollback()
            existing = session.execute(
                select(audio).where(audio.object_key == object_key)
            ).scalar_one_or_none()

            if existing:
                return str(existing.public_url or existing.object_key)

            # If still not found, it might be a different IntegrityError (e.g. ForeignKey)
            logging.error(f"❌ IntegrityError occurred but no existing record found for {object_key}. This might be a ForeignKey violation or other constraint.")
            raise
        except Exception as e:
            logging.error(f"❌ Database save failed: {e}")
            session.rollback()
            raise

        return public_url

    def get_audio_content(self, audio_id: int):
        """Retrieve audio content from S3 by audio ID

        :param audio_id: The audio record ID
        :return: Tuple of (content_bytes, content_type) if found, None if not found
        """
        # Get audio record from database
        audio_record = session.execute(
            select(audio).where(audio.audio_id == audio_id)
        ).scalar_one_or_none()

        if audio_record is None:
            return None

        # Try to get content from S3
        from flask import current_app
        s3 = S3(current_app)
        result = s3.get_object(audio_record.object_key)

        if result is None:
            return None

        content, _ = result  # Ignore S3's content_type, use our stored one
        return content, audio_record.content_type

    def get_audio_by_object_key(self, object_key: str):
        """Retrieve audio content from S3 by object key

        :param object_key: The S3 object key
        :return: Tuple of (content_bytes, content_type) if found, None if not found
        """
        # Get audio record from database
        audio_record = session.execute(
            select(audio).where(audio.object_key == object_key)
        ).scalar_one_or_none()

        if audio_record is None:
            return None

        # Try to get content from S3
        from flask import current_app
        s3 = S3(current_app)
        result = s3.get_object(object_key)

        if result is None:
            return None

        content, _ = result  # Ignore S3's content_type, use our stored one
        return content, audio_record.content_type

    def get_audio_url(self, audio_id: int, use_direct_serving: bool = True):
        """Get the URL to access an audio file

        :param audio_id: The audio record ID
        :param use_direct_serving: If True, return local serving URL, if False return S3 presigned URL
        :return: URL string if found, None if not found
        """
        # Get audio record from database
        audio_record = session.execute(
            select(audio).where(audio.audio_id == audio_id)
        ).scalar_one_or_none()

        if audio_record is None:
            return None

        if use_direct_serving:
            # Return URL to our Flask endpoint that serves the audio
            from flask import url_for
            return url_for('audio.serve_audio_file', audio_id=audio_id)
        else:
            # Return presigned S3 URL
            from flask import current_app
            s3 = S3(current_app)
            return s3.generate_presigned_url(audio_record.object_key, expiration=3600)

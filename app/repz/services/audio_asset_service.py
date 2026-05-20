import hashlib
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from repz.database import session
from repz.models import audio
from repz.aws_s3 import S3


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

    def ensure_audio_for_quiz_question(self, q: dict, language: str, parts=("question", "answer")) -> dict:
        """Audio generation is idempotent and separate from quiz progression"""
        import logging
        
        logging.info(f"🎵 ensure_audio_for_quiz_question called for question_id={q.get('question_id')}, parts={parts}")
        assets = {}

        part_to_text = {
            "question": q.get("question_text"),
            "answer": q.get("answer"),
            "hint": q.get("hint"),
        }
        
        logging.info(f"📄 Text parts available: {list(part_to_text.keys())}")

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
                )
                assets[part] = asset_url
                logging.info(f"✅ Successfully ensured audio for {part}: {asset_url}")
            except Exception as e:
                logging.error(f"❌ Failed to ensure audio for {part}: {e}")
                raise

        logging.info(f"🎧 Final assets: {assets}")
        return assets

    def ensure_audio(self, question_id: int, part: str, text: str, language: str) -> str:
        """Ensure audio exists for a given question part, creating if necessary"""
        import logging
        
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        object_key = f"audio/{language}/{question_id}/{part}-{text_hash}.wav"
        
        logging.info(f"🔑 Looking for existing audio with object_key: {object_key}")

        existing = session.execute(
            select(audio).where(audio.object_key == object_key)
        ).scalar_one_or_none()

        if existing is not None:
            logging.info(f"♾️ Found existing audio, returning: {existing.public_url or existing.object_key}")
            return str(existing.public_url or existing.object_key)

        logging.info(f"🎵 No existing audio found, creating new audio for: {text[:30]}...")
        
        try:
            audio_bytes, metadata = self.tts_client.create_audio(
                text=text,
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
                audio_text=text,
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
            ).scalar_one()
            return str(existing.public_url or existing.object_key)
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
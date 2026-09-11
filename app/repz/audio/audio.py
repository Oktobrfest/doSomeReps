from flask import abort
from flask_login import login_required
import tempfile
from pathlib import Path
from typing import Optional

from repz.routes import audio
from repz.services.audio_asset_service import AudioAssetService, S3StorageClient
from .create_audio import create_audio


class TTSClientAdapter:
    """Adapter to make create_audio compatible with AudioAssetService interface."""

    def __init__(self, piper_voices_dir=None):
        try:
            self.piper_client = create_audio(voices_dir=piper_voices_dir)
        except ImportError as e:
            raise RuntimeError(
                "piper-tts is required for audio functionality. "
                "Please install it with: pip install piper-tts"
            ) from e

    def create_audio(self, text: str, language: str, sentence_silence: Optional[float] = None) -> tuple[bytes, dict]:
        """Create MP3 audio and return (audio_bytes, metadata)."""

        language = language.replace("-", "_")

        if language not in self.piper_client.DEFAULT_VOICES:
            raise ValueError(f"Unsupported TTS language: {language}")

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
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



def build_audio_service() -> AudioAssetService:
    """The TTS-backed audio service, wired to S3 storage."""
    return AudioAssetService(TTSClientAdapter(), S3StorageClient())


@audio.route("/audio/file/<int:audio_id>", methods=["GET"])
@login_required
def serve_audio_file(audio_id):
    """Serve MP3 audio file from S3 by audio ID."""
    import logging
    import io
    from flask import send_file

    storage_client = S3StorageClient()
    audio_service = AudioAssetService(None, storage_client)

    result = audio_service.get_audio_content(audio_id)
    if result is None:
        logging.warning(f"❌ Audio content not found for ID: {audio_id}")
        abort(404)

    content, content_type = result

    return send_file(
        io.BytesIO(content),
        mimetype=str(content_type),
        as_attachment=False,
        conditional=True
    )


@audio.route("/audio/object/<path:object_key>", methods=["GET"])
@login_required
def serve_audio_by_key(object_key):
    """Serve MP3 audio file from S3 by object key."""
    import logging
    import io
    from flask import send_file

    logging.info(f"📥 serve_audio_by_key request for: {object_key}")

    storage_client = S3StorageClient()
    audio_service = AudioAssetService(None, storage_client)

    result = audio_service.get_audio_by_object_key(object_key)
    if result is None:
        logging.warning(f"❌ Audio content not found for key: {object_key}")
        abort(404)

    content, content_type = result
    logging.info(f"✅ Serving audio for {object_key}: {len(content)} bytes, type: {content_type}")

    return send_file(
        io.BytesIO(content),
        mimetype=str(content_type),
        as_attachment=False,
        download_name=object_key.split('/')[-1],
        conditional=True
    )

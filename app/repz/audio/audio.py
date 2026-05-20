from flask import Response, abort
from flask_login import login_required
import tempfile
from pathlib import Path

from repz.routes import audio
from repz.services.quiz_service import QuizPageConfig, render_quiz_page
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

    def create_audio(self, text: str, language: str) -> tuple[bytes, dict]:
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


def test_tts_functionality():
    """Simple test function to validate TTS is working - can be called from Flask shell."""
    try:
        adapter = TTSClientAdapter()
        audio_bytes, metadata = adapter.create_audio("Hello world", "en-US")
        print(f"✅ TTS test successful! Generated {len(audio_bytes)} bytes of MP3 audio")
        print(f"📊 Metadata: {metadata}")
        return True
    except Exception as e:
        print(f"❌ TTS test failed: {e}")
        return False


def test_audio_serving():
    """Test audio serving functionality - can be called from Flask shell."""
    try:
        from repz.database import session
        from repz.models import audio
        from sqlalchemy import select

        audio_record = session.execute(
            select(audio).limit(1)
        ).scalar_one_or_none()

        if not audio_record:
            print("⚠️ No audio records found in database")
            return False

        print(f"🎵 Testing audio record: {audio_record.audio_id}")
        print(f"🗝️ Object key: {audio_record.object_key}")
        print(f"🎧 Content type: {audio_record.content_type}")
        print(f"📊 Size: {audio_record.size_bytes} bytes")

        storage_client = S3StorageClient()
        audio_service = AudioAssetService(None, storage_client)

        result = audio_service.get_audio_content(audio_record.audio_id)
        if result:
            content, content_type = result
            print(f"✅ Successfully retrieved {len(content)} bytes with content type: {content_type}")
            return True

        print("❌ Failed to retrieve audio content")
        return False

    except Exception as e:
        print(f"❌ Audio serving test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


@audio.route("/audio", methods=["GET", "POST"], endpoint="audio_quiz")
@login_required
def audio_quiz():
    storage_client = S3StorageClient()
    tts_client = TTSClientAdapter()
    audio_service = AudioAssetService(tts_client, storage_client)

    return render_quiz_page(
        QuizPageConfig(
            mode="audio",
            template_name="audio.html",
            endpoint_name="audio.audio_quiz",
            title="Audio Quiz",
            description="Mobile-optimised quiz mode.",
        ),
        audio_service=audio_service,
    )


@audio.route("/audio/file/<int:audio_id>", methods=["GET"])
@login_required
def serve_audio_file(audio_id):
    """Serve MP3 audio file from S3 by audio ID."""
    storage_client = S3StorageClient()
    audio_service = AudioAssetService(None, storage_client)

    result = audio_service.get_audio_content(audio_id)
    if result is None:
        abort(404)

    content, content_type = result

    return Response(
        content,
        mimetype=str(content_type),
        headers={
            "Cache-Control": "public, max-age=3600",
            "Content-Length": str(len(content)),
        },
    )


@audio.route("/audio/object/<path:object_key>", methods=["GET"])
@login_required
def serve_audio_by_key(object_key):
    """Serve MP3 audio file from S3 by object key."""
    storage_client = S3StorageClient()
    audio_service = AudioAssetService(None, storage_client)

    result = audio_service.get_audio_by_object_key(object_key)
    if result is None:
        abort(404)

    content, content_type = result

    return Response(
        content,
        mimetype=str(content_type),
        headers={
            "Cache-Control": "public, max-age=3600",
            "Content-Length": str(len(content)),
        },
    )

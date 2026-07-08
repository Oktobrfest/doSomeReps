from flask import Response, abort, jsonify, request
from flask_login import current_user, login_required
import tempfile
from pathlib import Path
from typing import Optional

from repz.routes import audio
from repz.services.quiz_service import (
    AnswerVerdict,
    QuizPageConfig,
    render_quiz_page,
    _get_selected_categories,
    get_quiz_queue,
    build_audio_quiz_items,
    _exclude_quiz_question,
    _submit_quiz_answer,
)
from repz.cache_helper import CacheHelper
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


@audio.route("/audio/api/action", methods=["POST"], endpoint="audio_quiz_action")
@login_required
def audio_quiz_action():
    """
    JSON mutation endpoint for the audio SPA.

    This intentionally does NOT render /audio and does NOT redirect.
    The normal non-audio page can keep using the existing form POST route.
    """
    data = request.get_json(silent=True) or {}

    action = data.get("action")
    raw_quizq_id = data.get("quizqId")
    provided_answer = data.get("providedAnswer")

    try:
        quizq_id = int(raw_quizq_id)
    except (TypeError, ValueError):
        return jsonify({
            "ok": False,
            "error": "quizqId is required and must be an integer.",
        }), 400

    selected_categories = _get_selected_categories()
    if selected_categories == "Not set" or not selected_categories:
        return jsonify({
            "ok": False,
            "error": "No quiz categories are selected.",
        }), 400

    cache_helper = CacheHelper(current_user.id)
    que_list, que_cache_key = cache_helper.get_cached_questions(selected_categories)

    if action == "exclude":
        _exclude_quiz_question(
            user_id=current_user.id,
            quizq_id=quizq_id,
            que_list=que_list,
            que_cache_key=que_cache_key,
        )

        return jsonify({
            "ok": True,
            "action": "exclude",
            "quizqId": quizq_id,
        })

    if action == "submit":
        verdict_raw = data.get("verdict")

        try:
            verdict = AnswerVerdict(verdict_raw)
        except ValueError:
            return jsonify({
                "ok": False,
                "error": f"Invalid verdict: {verdict_raw!r}",
            }), 400

        _submit_quiz_answer(
            user_id=current_user.id,
            quizq_id=quizq_id,
            verdict=verdict,
            provided_answer=provided_answer,
            que_list=que_list,
            que_cache_key=que_cache_key,
            endpoint_name="audio.audio_quiz",
        )

        return jsonify({
            "ok": True,
            "action": "submit",
            "quizqId": quizq_id,
            "verdict": verdict.value,
        })

    return jsonify({
        "ok": False,
        "error": f"Invalid action: {action!r}",
    }), 400


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


@audio.route("/audio/quiz-data", methods=["GET"], endpoint="audio_quiz_data")
@login_required
def audio_quiz_data():
    """Return fully-populated audio quiz items for the SPA queue."""
    storage_client = S3StorageClient()
    tts_client = TTSClientAdapter()
    audio_service = AudioAssetService(tts_client, storage_client)

    selected_categories = _get_selected_categories()
    if selected_categories == "Not set" or not selected_categories:
        return jsonify({"items": []})

    user_id = current_user.id
    que_list = get_quiz_queue(user_id, selected_categories)
    if not que_list:
        return jsonify({"items": []})

    count = request.args.get("count", 1, type=int)
    if count < 1:
        count = 1

    exclude_raw = request.args.get("exclude_quizq_ids", "")
    exclude_quizq_ids = [
        x.strip() for x in exclude_raw.split(",") if x.strip()
    ]

    items = build_audio_quiz_items(
        que_list=que_list,
        audio_service=audio_service,
        user=current_user,
        count=count,
        exclude_quizq_ids=exclude_quizq_ids,
    )

    return jsonify({"items": items})

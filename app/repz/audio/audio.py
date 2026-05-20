from flask import Response, abort
from flask_login import login_required

from repz.routes import audio
from repz.services.quiz_service import QuizPageConfig, render_quiz_page
from repz.services.audio_asset_service import AudioAssetService, S3StorageClient


@audio.route("/audio", methods=["GET", "POST"], endpoint="audio_quiz")
@login_required
def audio_quiz():
    # Create storage client and audio service
    storage_client = S3StorageClient()
    # For now TTS client is None since it's not fully implemented yet
    # This will be updated when TTS integration is complete
    tts_client = None
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
    """Serve audio file from S3 by audio ID"""
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
            'Cache-Control': 'public, max-age=3600',  # Cache for 1 hour
            'Content-Length': str(len(content))
        }
    )


@audio.route("/audio/object/<path:object_key>", methods=["GET"])
@login_required
def serve_audio_by_key(object_key):
    """Serve audio file from S3 by object key"""
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
            'Cache-Control': 'public, max-age=3600',  # Cache for 1 hour
            'Content-Length': str(len(content))
        }
    )

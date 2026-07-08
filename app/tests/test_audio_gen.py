
from repz.audio.audio import TTSClientAdapter
from repz.services.audio_asset_service import AudioAssetService, S3StorageClient


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




def test_tts_functionality():
    """Simple test function to validate TTS is working - can be called from Flask shell."""
    try:
        adapter = TTSClientAdapter()
        audio_bytes, metadata = adapter.create_audio("Hello world", "en_US")
        print(f"✅ TTS test successful! Generated {len(audio_bytes)} bytes of MP3 audio")
        print(f"📊 Metadata: {metadata}")
        return True
    except Exception as e:
        print(f"❌ TTS test failed: {e}")
        return False

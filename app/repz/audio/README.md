# Audio Creation with S3 Integration

This module provides text-to-speech functionality using Piper TTS with automatic S3 upload capabilities.

## Features

- Text-to-speech conversion using Piper TTS
- Automatic S3 upload with metadata
- Database integration for storing audio records
- Support for multiple languages and voices
- Hierarchical S3 object key structure

## Basic Usage

```python
from app.repz.audio.create_audio import create_audio

# Initialize the audio creator
audio_creator = create_audio(
    voices_dir="/path/to/piper/voices",
    default_language="en_US",
    use_cuda=False
)

# Create audio file and upload to S3
result = audio_creator.create(
    text="Hello, this is a test message",
    output_path="/tmp/test_audio.wav",
    language="en_US",
    voice="en_US-lessac-medium",
    upload_to_s3=True  # This will upload to S3 automatically
)

print(f"Local file: {result.path}")
print(f"S3 object key: {result.object_key}")
print(f"Public URL: {result.public_url}")
print(f"File size: {result.size_bytes} bytes")
```

## Database Integration

```python
from app.repz.audio.create_audio import create_audio
from your_database_module import get_db_session

# Create audio and save to database
audio_creator = create_audio()

with get_db_session() as session:
    audio_record = audio_creator.create_and_save_to_db(
        text="What is the capital of France?",
        question_id=123,
        part="question",  # or "answer", "hint"
        language="en_US",
        session=session
    )
    
    print(f"Created audio record with ID: {audio_record.audio_id}")
    print(f"S3 URL: {audio_record.public_url}")
```

## S3 Object Structure

Audio files are stored in S3 using a hierarchical structure:

```
audio/tts/{language}/{voice}/{hash}.wav
```

For example:
- `audio/tts/en_US/en_US-lessac-medium/a1b2c3d4e5f6g7h8.wav`
- `audio/tts/fr_FR/fr_FR-siwis-medium/9i8j7k6l5m4n3o2p.wav`

## Configuration

The S3 integration uses the existing S3 class configuration. Make sure your Flask app has the following configuration:

```python
# In your Flask config
BUCKET = "your-s3-bucket-name"
REGION_NAME = "us-west-2"  # optional, defaults to us-west-2
ACCESS_KEY_ID = "your-aws-access-key"
SECRET_ACCESS_KEY = "your-aws-secret-key"
```

## Error Handling

The module is designed to be resilient:

- If S3 upload fails, the local file is still created and the operation continues
- S3 upload failures are logged but don't raise exceptions
- Database operations can be wrapped in transactions for atomicity

## Supported Languages

Default voices are configured for:
- `en_US`: English (US) - lessac-medium
- `en_GB`: English (UK) - alan-medium  
- `fr_FR`: French - siwis-medium
- `de_DE`: German - thorsten-medium

## AudioCreationResult Fields

The `AudioCreationResult` dataclass includes:

- `path`: Local file path
- `language`: Language code used
- `voice`: Voice model used
- `content_type`: MIME type (audio/wav)
- `size_bytes`: File size in bytes
- `object_key`: S3 object key (None if upload failed)
- `public_url`: S3 public URL (None if upload failed)
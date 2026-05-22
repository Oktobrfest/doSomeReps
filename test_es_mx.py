#!/usr/bin/env python3
import sys
import os
from pathlib import Path

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_es_mx_audio():
    from repz.audio.create_audio import create_audio
    
    print("Testing es_MX audio generation...")
    audio_gen = create_audio()
    
    output_path = Path("test_es_mx_output.mp3")
    if output_path.exists():
        output_path.unlink()
        
    try:
        result = audio_gen.create(
            text="Hola, esto es una prueba del sistema de generación de audio en español de México.",
            output_path=output_path,
            language="es_MX",
            upload_to_s3=False,
            overwrite=True
        )
        print("✅ SUCCESS!")
        print(f"Path: {result.path}")
        print(f"Size: {result.size_bytes} bytes")
        print(f"Voice: {result.voice}")
        print(f"Language: {result.language}")
        return True
    except Exception as e:
        print(f"❌ FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if output_path.exists():
            output_path.unlink()

if __name__ == "__main__":
    test_es_mx_audio()

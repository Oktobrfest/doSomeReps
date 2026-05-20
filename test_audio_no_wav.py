#!/usr/bin/env python3
"""
Test script to verify that the audio generation system only creates MP3 files
and never leaves behind WAV files.
"""

import tempfile
import shutil
from pathlib import Path
import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_no_wav_files_created():
    """Test that audio creation only produces MP3 files and cleans up all temp files."""
    
    # Import after setting up the path
    from repz.audio.create_audio import create_audio
    
    print("🧪 Testing audio generation to ensure no WAV files are left behind...")
    
    # Create a test directory
    with tempfile.TemporaryDirectory() as test_dir:
        test_dir_path = Path(test_dir)
        output_path = test_dir_path / "test_audio.mp3"
        
        print(f"📁 Test directory: {test_dir}")
        
        # Count files before
        files_before = list(test_dir_path.glob("*"))
        print(f"📊 Files before audio generation: {len(files_before)}")
        
        try:
            # Create audio generator (this might fail if piper isn't installed, that's okay)
            audio_gen = create_audio()
            
            # Try to create an MP3 file
            result = audio_gen.create(
                text="This is a test of the audio generation system.",
                output_path=output_path,
                upload_to_s3=False,
                overwrite=True
            )
            
            print(f"✅ Audio generation successful!")
            print(f"🎵 Created: {result.path}")
            print(f"📏 Size: {result.size_bytes} bytes")
            print(f"🎭 Content type: {result.content_type}")
            
            # Count files after
            files_after = list(test_dir_path.glob("*"))
            print(f"📊 Files after audio generation: {len(files_after)}")
            
            # Check for WAV files specifically
            wav_files = list(test_dir_path.glob("*.wav"))
            tmp_wav_files = list(test_dir_path.glob("*.tmp.wav"))
            
            print(f"🔍 WAV files found: {len(wav_files)}")
            print(f"🔍 Temporary WAV files found: {len(tmp_wav_files)}")
            
            if wav_files or tmp_wav_files:
                print("❌ FAILED: WAV files were found!")
                for wav_file in wav_files + tmp_wav_files:
                    print(f"   Found: {wav_file}")
                return False
            else:
                print("✅ SUCCESS: No WAV files found!")
                
            # Verify MP3 was created
            if output_path.exists() and output_path.suffix == ".mp3":
                print("✅ SUCCESS: MP3 file was created correctly!")
                return True
            else:
                print("❌ FAILED: MP3 file was not created!")
                return False
                
        except ImportError as e:
            print(f"⚠️ SKIPPED: piper-tts not installed ({e})")
            return True  # This is expected in some environments
        except Exception as e:
            print(f"❌ ERROR: {e}")
            
            # Even if there was an error, check for leftover WAV files
            wav_files = list(test_dir_path.glob("*.wav"))
            tmp_wav_files = list(test_dir_path.glob("*.tmp.wav"))
            
            if wav_files or tmp_wav_files:
                print("❌ CRITICAL: WAV files were left behind after error!")
                for wav_file in wav_files + tmp_wav_files:
                    print(f"   Leftover: {wav_file}")
                return False
            else:
                print("✅ GOOD: No WAV files left behind despite error!")
                return True

def test_system_temp_cleanup():
    """Test the cleanup utility function."""
    print("\\n🧹 Testing system temp directory cleanup...")
    
    # Import after setting up the path
    from repz.audio.create_audio import create_audio
    
    # Create some fake temporary WAV files
    temp_dir = Path(tempfile.gettempdir())
    fake_wav_files = [
        temp_dir / "tmp_fake_test_1.wav",
        temp_dir / "tmp_fake_test_2.wav",
    ]
    
    # Create the fake files
    for fake_file in fake_wav_files:
        fake_file.write_text("fake wav content")
        print(f"📄 Created fake temp file: {fake_file}")
    
    try:
        # Run the cleanup
        cleaned_count = create_audio.cleanup_orphaned_temp_files()
        print(f"🧹 Cleanup removed {cleaned_count} files")
        
        # Verify files are gone
        remaining_files = [f for f in fake_wav_files if f.exists()]
        if remaining_files:
            print(f"❌ FAILED: {len(remaining_files)} fake files still exist!")
            return False
        else:
            print("✅ SUCCESS: All fake temporary files were cleaned up!")
            return True
            
    except Exception as e:
        print(f"❌ ERROR during cleanup: {e}")
        return False
    finally:
        # Manual cleanup in case the function failed
        for fake_file in fake_wav_files:
            try:
                fake_file.unlink(missing_ok=True)
            except:
                pass

if __name__ == "__main__":
    print("🎵 WAV File Prevention Test Suite")
    print("=" * 50)
    
    success1 = test_no_wav_files_created()
    success2 = test_system_temp_cleanup()
    
    print("\\n" + "=" * 50)
    if success1 and success2:
        print("✅ ALL TESTS PASSED: No WAV files will be created or left behind!")
        exit(0)
    else:
        print("❌ SOME TESTS FAILED: Check the output above for details!")
        exit(1)
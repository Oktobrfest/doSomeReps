"""Text-to-speech audio creation with Piper, outputting real MP3 files.

Piper writes WAV audio, so this creates a temporary WAV internally and then
converts it to MP3 with ffmpeg.
"""

from __future__ import annotations

import contextlib
import hashlib
import logging
import os
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Any, ClassVar, Iterable, Optional, Union

from flask import current_app
from ..aws_s3 import S3

_LOGGER = logging.getLogger(__name__)

PathLike = Union[str, Path]


@dataclass(frozen=True)
class AudioCreationResult:
    """Metadata for a created audio file."""

    path: Path
    language: str
    voice: str
    content_type: str
    size_bytes: int
    object_key: Optional[str] = None
    public_url: Optional[str] = None


class create_audio:
    """Create MP3 speech audio files from text using Piper."""

    DEFAULT_LANGUAGE = "en_US"
    CONTENT_TYPE = "audio/mpeg"
    OUTPUT_SUFFIX = ".mp3"

    DEFAULT_VOICES: ClassVar[dict[str, str]] = {
        "en_US": "en_US-lessac-medium",
        "en_GB": "en_GB-alan-medium",
        "fr_FR": "fr_FR-siwis-medium",
        "de_DE": "de_DE-thorsten-medium",
        "es_ES": "es_ES-sharvard-medium",
        "es_MX": "es_MX-claude-high",
        "ru_RU": "ru_RU-irina-medium",
    }

    DEFAULT_SPEAKER_IDS: ClassVar[dict[str, int]] = {
        "es_ES-sharvard-medium": 1,  # Speaker 'F' (Female)
    }

    _voice_cache: ClassVar[dict[tuple[str, bool, str], Any]] = {}
    _cache_lock: ClassVar[RLock] = RLock()

    def __init__(
        self,
        voices_dir: Optional[PathLike] = None,
        default_language: str = DEFAULT_LANGUAGE,
        use_cuda: bool = False,
        length_scale: Optional[float] = 1.0,
        noise_scale: Optional[float] = None,
        noise_w_scale: Optional[float] = None,
        volume: float = 1.0,
        mp3_bitrate: str = "128k",
        sentence_silence: Optional[float] = None,
    ) -> None:
        self.voices_dir = Path(voices_dir or Path.cwd() / "piper_voices")
        self.default_language = default_language
        self.use_cuda = use_cuda
        self.length_scale = length_scale
        self.noise_scale = noise_scale
        self.noise_w_scale = noise_w_scale
        self.volume = volume
        self.mp3_bitrate = mp3_bitrate
        self.sentence_silence = sentence_silence

    def create(
        self,
        text: str,
        output_path: PathLike,
        language: Optional[str] = None,
        voice: Optional[str] = None,
        speaker_id: Optional[int] = None,
        overwrite: bool = False,
        upload_to_s3: bool = True,
        sentence_silence: Optional[float] = None,
    ) -> AudioCreationResult:
        """Create an MP3 audio file from text."""

        clean_text = self._validate_text(text)
        target_path = Path(output_path)

        if target_path.suffix.lower() != self.OUTPUT_SUFFIX:
            raise ValueError("Audio output path must end in .mp3")

        if target_path.exists() and not overwrite:
            raise FileExistsError(
                f"Refusing to overwrite existing audio file: {target_path}"
            )

        if shutil.which("ffmpeg") is None:
            raise RuntimeError("ffmpeg is required to create MP3 audio")

        selected_language = language or self.default_language

        if selected_language not in self.DEFAULT_VOICES:
            raise ValueError(f"Unsupported language: {selected_language}")

        selected_voice = voice or self.DEFAULT_VOICES[selected_language]

        target_path.parent.mkdir(parents=True, exist_ok=True)

        piper_voice = self._load_voice(selected_voice)

        actual_speaker_id = speaker_id
        if actual_speaker_id is None:
            actual_speaker_id = self.DEFAULT_SPEAKER_IDS.get(selected_voice)

        syn_config = self._synthesis_config(speaker_id=actual_speaker_id)

        # Use explicitly passed sentence_silence or fallback to default
        silence_sec = sentence_silence if sentence_silence is not None else self.sentence_silence

        # Create temporary files in system temp directory to avoid leaving WAV files in target directory
        temp_wav_file = tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False
        )
        temp_wav_path = Path(temp_wav_file.name)
        temp_wav_file.close()  # Close the file handle so Piper can write to it
        _LOGGER.debug(f"Created temporary WAV file: {temp_wav_path}")

        temp_mp3_file = tempfile.NamedTemporaryFile(
            suffix=".mp3",
            delete=False
        )
        temp_mp3_path = Path(temp_mp3_file.name)
        temp_mp3_file.close()  # Close the file handle so ffmpeg can write to it
        _LOGGER.debug(f"Created temporary MP3 file: {temp_mp3_path}")

        try:
            # Generate WAV audio using Piper
            with open(os.devnull, "w") as devnull:
                with contextlib.redirect_stdout(devnull), contextlib.redirect_stderr(devnull):
                    with wave.open(str(temp_wav_path), "wb") as wav_file:
                        if silence_sec and silence_sec > 0:
                            # 16-bit samples for silence
                            silence_int16_bytes = bytes(
                                int(piper_voice.config.sample_rate * silence_sec * 2)
                            )
                            wav_params_set = False
                            for i, audio_chunk in enumerate(piper_voice.synthesize(clean_text, syn_config)):
                                if not wav_params_set:
                                    wav_file.setframerate(audio_chunk.sample_rate)
                                    wav_file.setsampwidth(audio_chunk.sample_width)
                                    wav_file.setnchannels(audio_chunk.sample_channels)
                                    wav_params_set = True

                                if i > 0:
                                    wav_file.writeframes(silence_int16_bytes)

                                wav_file.writeframes(audio_chunk.audio_int16_bytes)
                        else:
                            piper_voice.synthesize_wav(
                                clean_text,
                                wav_file,
                                syn_config=syn_config,
                            )

            # Convert WAV to MP3
            self._convert_wav_to_mp3(temp_wav_path, temp_mp3_path)

            # Move the final MP3 to the target location
            temp_mp3_path.replace(target_path)

        except Exception:
            # If anything fails, make sure target file doesn't exist in a partial state
            target_path.unlink(missing_ok=True)
            raise
        finally:
            # Always clean up temporary files (both WAV and MP3)
            if temp_wav_path.exists():
                temp_wav_path.unlink()
                _LOGGER.debug(f"Cleaned up temporary WAV file: {temp_wav_path}")
            if temp_mp3_path.exists():
                temp_mp3_path.unlink()
                _LOGGER.debug(f"Cleaned up temporary MP3 file: {temp_mp3_path}")

        size_bytes = target_path.stat().st_size
        object_key = None
        public_url = None

        if upload_to_s3:
            s3 = S3(current_app)

            object_key = self._generate_s3_object_key(
                text=clean_text,
                language=selected_language,
                voice=selected_voice,
            )

            upload_result = s3.upload_file_to_s3(
                file_name=str(target_path),
                ExtraArgs={
                    "ContentType": self.CONTENT_TYPE,
                    "Metadata": {
                        "language": selected_language,
                        "voice": selected_voice,
                        "tts_engine": "piper",
                        "audio_format": "mp3",
                    },
                },
                object_name=object_key,
            )

            if not upload_result:
                raise RuntimeError(f"S3 upload failed for: {object_key}")

            public_url = upload_result
            _LOGGER.info("Uploaded MP3 audio file to S3: %s", object_key)

        return AudioCreationResult(
            path=target_path,
            language=selected_language,
            voice=selected_voice,
            content_type=self.CONTENT_TYPE,
            size_bytes=size_bytes,
            object_key=object_key,
            public_url=public_url,
        )

    def create_in_directory(
        self,
        text: str,
        output_dir: PathLike,
        language: Optional[str] = None,
        filename: Optional[str] = None,
        voice: Optional[str] = None,
        speaker_id: Optional[int] = None,
        overwrite: bool = False,
        upload_to_s3: bool = True,
        sentence_silence: Optional[float] = None,
    ) -> AudioCreationResult:
        """Create an MP3 file in a directory with a deterministic filename."""

        selected_language = language or self.default_language
        output_filename = filename or self._default_filename(text, selected_language)

        if not output_filename.lower().endswith(".mp3"):
            raise ValueError("Audio filename must end in .mp3")

        return self.create(
            text=text,
            output_path=Path(output_dir) / output_filename,
            language=selected_language,
            voice=voice,
            speaker_id=speaker_id,
            overwrite=overwrite,
            upload_to_s3=upload_to_s3,
            sentence_silence=sentence_silence,
        )

    def __call__(
        self,
        text: str,
        output_path: PathLike,
        language: Optional[str] = None,
        voice: Optional[str] = None,
        speaker_id: Optional[int] = None,
        overwrite: bool = False,
        upload_to_s3: bool = True,
        sentence_silence: Optional[float] = None,
    ) -> AudioCreationResult:
        return self.create(
            text=text,
            output_path=output_path,
            language=language,
            voice=voice,
            speaker_id=speaker_id,
            overwrite=overwrite,
            upload_to_s3=upload_to_s3,
            sentence_silence=sentence_silence,
        )

    @classmethod
    def supported_languages(cls) -> tuple[str, ...]:
        return tuple(sorted(cls.DEFAULT_VOICES))

    @classmethod
    def clear_voice_cache(cls) -> None:
        with cls._cache_lock:
            cls._voice_cache.clear()

    def _load_voice(self, voice_name: str) -> Any:
        self._ensure_voice_files(voice_name)
        cache_key = (voice_name, self.use_cuda, str(self.voices_dir.resolve()))

        with self._cache_lock:
            cached_voice = self._voice_cache.get(cache_key)
            if cached_voice is not None:
                return cached_voice

            from piper import PiperVoice  # type: ignore[import-not-found]

            model_path = self.voices_dir / f"{voice_name}.onnx"
            config_path = self.voices_dir / f"{voice_name}.onnx.json"

            loaded_voice = PiperVoice.load(
                model_path,
                config_path=config_path,
                use_cuda=self.use_cuda,
                download_dir=self.voices_dir,
            )

            self._voice_cache[cache_key] = loaded_voice
            return loaded_voice

    def _ensure_voice_files(self, voice_name: str) -> None:
        model_path = self.voices_dir / f"{voice_name}.onnx"
        config_path = self.voices_dir / f"{voice_name}.onnx.json"

        if model_path.exists() and config_path.exists():
            return

        self.voices_dir.mkdir(parents=True, exist_ok=True)
        _LOGGER.info("Downloading Piper voice '%s' into '%s'", voice_name, self.voices_dir)

        try:
            from piper.download_voices import download_voice  # type: ignore[import-not-found]
        except ImportError as exc:
            raise RuntimeError(
                "piper-tts is required to create audio. Install project requirements."
            ) from exc

        download_voice(voice_name, self.voices_dir)

        if not model_path.exists() or not config_path.exists():
            raise FileNotFoundError(
                f"Piper voice download did not create expected files for {voice_name}"
            )

    def _synthesis_config(self, speaker_id: Optional[int] = None) -> Any:
        from piper import SynthesisConfig  # type: ignore[import-not-found]

        return SynthesisConfig(
            speaker_id=speaker_id,
            length_scale=self.length_scale,
            noise_scale=self.noise_scale,
            noise_w_scale=self.noise_w_scale,
            normalize_audio=True,
            volume=self.volume,
        )

    def _convert_wav_to_mp3(self, wav_path: Path, mp3_path: Path) -> None:
        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            self.mp3_bitrate,
            str(mp3_path),
        ]

        result = subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"ffmpeg failed to convert WAV to MP3: {result.stderr.strip()}"
            )

        if not mp3_path.exists() or mp3_path.stat().st_size == 0:
            raise RuntimeError(f"ffmpeg did not create a valid MP3 file: {mp3_path}")

    @staticmethod
    def _validate_text(text: str) -> str:
        if not isinstance(text, str):
            raise TypeError("text must be a string")

        clean_text = text.strip()

        if not clean_text:
            raise ValueError("text must not be empty")

        return clean_text

    @staticmethod
    def _default_filename(text: str, language: str) -> str:
        digest_source = f"{language}\n{text}".encode("utf-8")
        digest = hashlib.sha256(digest_source).hexdigest()[:16]
        return f"tts-{language}-{digest}.mp3"

    @staticmethod
    def _generate_s3_object_key(text: str, language: str, voice: str) -> str:
        digest_source = f"{language}\n{voice}\n{text}".encode("utf-8")
        digest = hashlib.sha256(digest_source).hexdigest()[:16]
        return f"audio/tts/{language}/{voice}/{digest}.mp3"

    @staticmethod
    def iter_supported_languages() -> Iterable[str]:
        return iter(create_audio.supported_languages())

    def create_and_save_to_db(
        self,
        text: str,
        question_id: int,
        part: str,
        language: Optional[str] = None,
        voice: Optional[str] = None,
        speaker_id: Optional[int] = None,
        overwrite: bool = False,
        session=None,
        sentence_silence: Optional[float] = None,
    ) -> Any:
        from ..models import audio

        if session is None:
            raise ValueError("Database session must be provided")

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            temp_path = Path(temp_file.name)

        try:
            result = self.create(
                text=text,
                output_path=temp_path,
                language=language,
                voice=voice,
                speaker_id=speaker_id,
                overwrite=overwrite,
                upload_to_s3=True,
                sentence_silence=sentence_silence,
            )

            if not result.object_key:
                raise RuntimeError("Failed to upload MP3 audio file to S3")

            audio_record = audio(
                question_id=question_id,
                part=part,
                audio_text=text,
                object_key=result.object_key,
                public_url=result.public_url,
                content_type=result.content_type,
                size_bytes=result.size_bytes,
                tts_engine="piper",
                tts_voice=result.voice,
                language=result.language,
            )

            session.add(audio_record)
            session.commit()

            return audio_record

        finally:
            temp_path.unlink(missing_ok=True)

    @staticmethod
    def cleanup_orphaned_temp_files(directory: Optional[PathLike] = None) -> int:
        """Clean up any orphaned temporary WAV files that may have been left behind.

        This utility function can be called periodically to ensure no WAV files
        are left in the filesystem from failed audio generation attempts.

        :param directory: Directory to clean up (defaults to system temp directory)
        :return: Number of files cleaned up
        """
        import tempfile
        import glob

        if directory is None:
            directory = Path(tempfile.gettempdir())
        else:
            directory = Path(directory)

        # Look for temporary WAV files that might have been left behind
        temp_wav_pattern = str(directory / "tmp*.wav")
        wav_files = glob.glob(temp_wav_pattern)

        cleaned_count = 0
        for wav_file in wav_files:
            try:
                Path(wav_file).unlink()
                _LOGGER.info(f"Cleaned up orphaned temporary WAV file: {wav_file}")
                cleaned_count += 1
            except Exception as e:
                _LOGGER.warning(f"Failed to clean up temporary WAV file {wav_file}: {e}")

        if cleaned_count > 0:
            _LOGGER.info(f"Cleaned up {cleaned_count} orphaned temporary WAV files")

        return cleaned_count

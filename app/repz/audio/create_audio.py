"""Text-to-speech audio creation with Piper.

Piper requires a voice model (``.onnx``) and matching config
(``.onnx.json``). This wrapper downloads the selected voice on first use,
loads it once, and reuses the in-memory model for subsequent synthesis.
"""

from __future__ import annotations

import hashlib
import logging
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
    """Create speech audio files from text using Piper.

    The class name intentionally follows the requested ``create_audio`` name.
    New code may prefer wrapping/aliasing it with a conventional PascalCase
    class name if desired.

    Parameters
    ----------
    voices_dir:
        Directory where Piper voice model files are stored. Missing voice files
        are downloaded automatically on first use.
    default_language:
        Language used when a method call does not provide one. Both BCP-47
        style (``en-US``) and Piper style (``en_US``) inputs are accepted.
    use_cuda:
        Enable CUDA when loading Piper voices. This requires ``onnxruntime-gpu``.
    length_scale:
        Speech speed. Values greater than 1.0 are slower; lower values are
        faster. The default keeps Piper's natural pace for clarity.
    noise_scale / noise_w_scale:
        Piper variation controls. Defaults are the Piper defaults and provide
        clear speech without making the output overly flat.
    volume:
        Output volume multiplier.
    """

    DEFAULT_LANGUAGE = "en_US"
    CONTENT_TYPE = "audio/wav"

    DEFAULT_VOICES: ClassVar[dict[str, str]] = {
        "en_US": "en_US-lessac-medium",
        "en_GB": "en_GB-alan-medium",
        "fr_FR": "fr_FR-siwis-medium",
        "de_DE": "de_DE-thorsten-medium",
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
    ) -> None:
        self.voices_dir = Path(voices_dir or Path.cwd() / "piper_voices")
        self.default_language = default_language
        self.use_cuda = use_cuda
        self.length_scale = length_scale
        self.noise_scale = noise_scale
        self.noise_w_scale = noise_w_scale
        self.volume = volume

    def create(
        self,
        text: str,
        output_path: PathLike,
        language: Optional[str] = None,
        voice: Optional[str] = None,
        speaker_id: Optional[int] = None,
        overwrite: bool = False,
        upload_to_s3: bool = True,
    ) -> AudioCreationResult:
        """Create a WAV audio file from text.

        Returns metadata about the created file. The output path should end in
        ``.wav`` because Piper's Python API writes WAV data directly.
        
        If upload_to_s3 is True, the file will also be uploaded to S3 and
        the result will include object_key and public_url.
        """
        clean_text = self._validate_text(text)
        target_path = Path(output_path)
        selected_language = language or self.default_language
        selected_voice = voice or self.DEFAULT_VOICES[selected_language]

        if target_path.exists() and not overwrite:
            raise FileExistsError(
                f"Refusing to overwrite existing audio file: {target_path}"
            )

        if target_path.suffix.lower() != ".wav":
            raise ValueError("Piper audio output must use a .wav file extension")

        target_path.parent.mkdir(parents=True, exist_ok=True)
        piper_voice = self._load_voice(selected_voice)
        syn_config = self._synthesis_config(speaker_id=speaker_id)

        with tempfile.NamedTemporaryFile(
            dir=target_path.parent,
            prefix=f".{target_path.stem}-",
            suffix=".tmp.wav",
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)

        try:
            with wave.open(str(temp_path), "wb") as wav_file:
                piper_voice.synthesize_wav(clean_text, wav_file, syn_config=syn_config)

            temp_path.replace(target_path)
        except Exception:
            temp_path.unlink(missing_ok=True)
            raise

        # Prepare the base result
        size_bytes = target_path.stat().st_size
        object_key = None
        public_url = None
        
        # Upload to S3 if requested
        if upload_to_s3:
            try:
                s3 = S3(current_app)
                
                # Generate S3 object key
                object_key = self._generate_s3_object_key(text, selected_language, selected_voice)
                
                # Upload to S3 with appropriate metadata
                extra_args = {
                    'ContentType': self.CONTENT_TYPE,
                    'Metadata': {
                        'language': selected_language,
                        'voice': selected_voice,
                        'tts_engine': 'piper'
                    }
                }
                
                upload_result = s3.upload_file_to_s3(
                    file_name=str(target_path),
                    ExtraArgs=extra_args,
                    object_name=object_key
                )
                
                if upload_result and upload_result is not False:
                    public_url = upload_result
                    _LOGGER.info(f"Uploaded audio file to S3: {object_key}")
                else:
                    _LOGGER.error(f"S3 upload failed for: {object_key}")
                    object_key = None
                    public_url = None
                
            except Exception as e:
                _LOGGER.error(f"Failed to upload audio file to S3: {e}")
                # Don't fail the entire operation if S3 upload fails
                object_key = None
                public_url = None

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
    ) -> AudioCreationResult:
        """Create a WAV file in a directory with a deterministic filename."""
        selected_language = language or self.default_language
        output_directory = Path(output_dir)
        output_filename = filename or self._default_filename(text, selected_language)

        if not output_filename.lower().endswith(".wav"):
            output_filename = f"{output_filename}.wav"

        return self.create(
            text=text,
            output_path=output_directory / output_filename,
            language=selected_language,
            voice=voice,
            speaker_id=speaker_id,
            overwrite=overwrite,
            upload_to_s3=upload_to_s3,
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
    ) -> AudioCreationResult:
        """Alias for ``create``."""
        return self.create(
            text=text,
            output_path=output_path,
            language=language,
            voice=voice,
            speaker_id=speaker_id,
            overwrite=overwrite,
            upload_to_s3=upload_to_s3,
        )

    @classmethod
    def supported_languages(cls) -> tuple[str, ...]:
        """Return language codes that have default Piper voices configured."""
        return tuple(sorted(cls.DEFAULT_VOICES))

    @classmethod
    def clear_voice_cache(cls) -> None:
        """Clear cached in-memory Piper voice models."""
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
                "piper-tts is required to create audio. Install project "
                "requirements before using create_audio."
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
        return f"tts-{language}-{digest}.wav"
    
    @staticmethod
    def _generate_s3_object_key(text: str, language: str, voice: str) -> str:
        """Generate a unique S3 object key for the audio file."""
        # Include voice in the hash for more specificity
        digest_source = f"{language}\n{voice}\n{text}".encode("utf-8")
        digest = hashlib.sha256(digest_source).hexdigest()[:16]
        
        # Use a hierarchical structure: audio/tts/language/voice/hash.wav
        return f"audio/tts/{language}/{voice}/{digest}.wav"

    @staticmethod
    def iter_supported_languages() -> Iterable[str]:
        """Yield supported language codes."""
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
    ) -> Any:
        """Create audio and save metadata to database.
        
        Args:
            text: Text to convert to speech
            question_id: ID of the related question
            part: Part of the question ('question', 'answer', 'hint')
            language: Language code
            voice: Voice to use
            speaker_id: Speaker ID for multi-speaker voices
            overwrite: Whether to overwrite existing files
            session: Database session (if None, will be imported)
        
        Returns:
            audio: The created audio database record
        """
        from ..models import audio
        
        if session is None:
            # This assumes you have a way to get the database session
            # You might need to adjust this based on your app structure
            raise ValueError("Database session must be provided")
        
        # Create temporary local file for audio generation
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_path = Path(temp_file.name)
        
        try:
            # Create the audio file and upload to S3
            result = self.create(
                text=text,
                output_path=temp_path,
                language=language,
                voice=voice,
                speaker_id=speaker_id,
                overwrite=overwrite,
                upload_to_s3=True,
            )
            
            if not result.object_key:
                raise RuntimeError("Failed to upload audio file to S3")
            
            # Create database record
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
            # Clean up temporary file
            temp_path.unlink(missing_ok=True)

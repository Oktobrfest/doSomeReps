"""Ask AI page.

Provides API endpoints for Ask AI transcription, reasoning (LLM), and text-to-speech.
"""

import logging
from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from repz.routes import ai
from ..database import session
from ..models import users
from .litellm_client import completion_for_user, AIConfigError
from .prompts import (
    SYSTEM_PROMPT,
    ANSWER_SECTION_REVEALED,
    ANSWER_SECTION_NOT_REVEALED,
    USER_PROMPT,
)

TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe"

IMAGE_MODALITY = "image"


# completion_for_user() silently falls back to the legacy text
# columns when a modality has no integration, which would send images to a
# text-only model. Check up front so we can fail loudly instead.
def _modality_is_configured(user_obj, modality: str) -> bool:
    integrations = getattr(user_obj, "ai_integrations", None) or []
    integration = next((i for i in integrations if i.modality == modality), None)
    if not integration or not integration.provider_relation:
        return False
    return bool(integration.provider_relation.api_key and integration.model)


# Keep only absolute http(s) URLs before they reach a paid API.
def _sanitize_image_urls(raw_urls) -> list:
    if not isinstance(raw_urls, (list, tuple)):
        return []
    # Also accept data: URLs so unsaved questions (/addcontent) can
    # send images that are not on S3 yet.
    return [
        u.strip() for u in raw_urls
        if isinstance(u, str)
        and u.strip().lower().startswith(("http://", "https://", "data:image/"))
    ]

def _resolve_stt_config(user_obj):
    """Return (api_key, api_base, model) for STT transcription."""
    integration = next((i for i in user_obj.ai_integrations if i.modality == "stt"), None)
    if integration and integration.provider_relation:
        return (
            integration.provider_relation.api_key,
            integration.provider_relation.api_base or None,
            integration.model or TRANSCRIBE_MODEL,
        )
    # Default STT uses the user's OpenAI API key directly.  Don't reuse the
    # legacy text/chat ai_api_base here: it often points to OpenRouter,
    # DeepSeek, proxies, etc. that do not implement /v1/audio/transcriptions.
    return (
        getattr(user_obj, "ai_api_key", None),
        None,
        TRANSCRIBE_MODEL,
    )


@ai.route("/api/ask-ai/transcribe", methods=["POST"])
@login_required
def ask_ai_transcribe():
    """API endpoint to transcribe Ask AI audio questions."""
    import os
    import tempfile
    import time

    logger = logging.getLogger(__name__ + ".transcribe")
    t_total = time.perf_counter()
    logger.info("=== TRANSCRIBE REQUEST START ===")
    logger.info("Request.files keys: %s", list(request.files.keys()))

    if "audio" not in request.files:
        logger.warning("No 'audio' field in request.files")
        return jsonify({"ok": False, "error": "No audio file provided in the request."}), 400

    audio_file = request.files["audio"]
    logger.info("Audio file: filename=%r, content_type=%r, content_length=%s",
                audio_file.filename, audio_file.content_type, audio_file.content_length)

    if audio_file.filename == "":
        logger.warning("Empty filename")
        return jsonify({"ok": False, "error": "Empty audio file filename."}), 400

    t_user = time.perf_counter()
    user_obj = session.execute(
        select(users).where(users.id == current_user.id)
    ).scalar_one()
    logger.info("User id=%d, loaded OK", user_obj.id)
    logger.debug("transcribe user_lookup=%.3fs", time.perf_counter() - t_user)

    t_cfg = time.perf_counter()
    api_key, api_base, model = _resolve_stt_config(user_obj)
    logger.info("STT config: model=%r api_base=%r has_key=%s",
                model, api_base, bool(api_key))
    logger.debug("transcribe _resolve_stt_config=%.3fs", time.perf_counter() - t_cfg)

    if not api_key:
        logger.warning("No API key configured for STT")
        return jsonify({"ok": False, "error": "AI API Key not configured. Please set one on your profile page."}), 400

    # Save to a safe temporary file
    t_tmp = time.perf_counter()
    fd, temp_path = tempfile.mkstemp(suffix=".webm")
    logger.info("Temp file path: %s", temp_path)
    logger.debug("transcribe mkstemp=%.3fs", time.perf_counter() - t_tmp)

    try:
        t_save = time.perf_counter()
        with os.fdopen(fd, "wb") as tmp:
            audio_file.save(tmp)

        file_size = os.path.getsize(temp_path)
        logger.info("Saved audio to disk, size=%d bytes", file_size)
        logger.debug("transcribe save=%.3fs", time.perf_counter() - t_save)

        if file_size == 0:
            logger.warning("Audio file is empty on disk")
            return jsonify({"ok": False, "error": "Audio file is empty."}), 400

        # Use the OpenAI client directly instead of litellm.transcription()
        # because LiteLLM's transcription handler strips the "openai/" prefix
        # from the model name before sending it in the JSON body.  Providers
        # like DeepInfra require the full "openai/whisper-large-v3" string
        # as the model parameter, so we must bypass LiteLLM for STT.
        t_openai_import = time.perf_counter()
        from openai import OpenAI
        logger.debug("transcribe openai import=%.3fs", time.perf_counter() - t_openai_import)

        t_client = time.perf_counter()
        client_kwargs: dict = {"api_key": api_key}
        if api_base:
            # The OpenAI-compatible audio endpoint is underneath api_base.
            # api_base is e.g. "https://api.deepinfra.com/v1/openai"
            # Ensure it ends with a single trailing slash so URL path segments join correctly.
            client_kwargs["base_url"] = api_base.rstrip("/") + "/"

        logger.info("OpenAI client base_url argument=%s", client_kwargs.get("base_url"))

        client = OpenAI(**client_kwargs)

        logger.info(
            "Resolved STT configuration: model=%r db_api_base=%r "
            "env_OPENAI_BASE_URL=%r final_client_base_url=%s",
            model,
            api_base,
            os.getenv("OPENAI_BASE_URL"),
            client.base_url,
        )

        logger.debug(
            "transcribe openai client ctor=%.3fs",
            time.perf_counter() - t_client,
        )

        logger.info("Calling client.audio.transcriptions.create with model=%r", model)
        client = OpenAI(**client_kwargs)
        logger.debug("transcribe openai client ctor=%.3fs", time.perf_counter() - t_client)

        logger.info("Calling client.audio.transcriptions.create with model=%r", model)
        t_api = time.perf_counter()
        with open(temp_path, "rb") as f:
            resp = client.audio.transcriptions.create(
                model=model,
                file=f,
            )
        api_elapsed = time.perf_counter() - t_api
        logger.info("[BOTTLENECK CANDIDATE] audio.transcriptions.create took %.3fs", api_elapsed)

        # resp is an object with a .text attribute (standard openai shape)
        transcript = resp.text if hasattr(resp, "text") else str(resp)
        logger.info("Transcription result: %r", transcript)

        logger.info("=== TRANSCRIBE REQUEST SUCCESS (total=%.3fs, stt_api=%.3fs) ===",
                    time.perf_counter() - t_total, api_elapsed)
        return jsonify({"ok": True, "transcript": transcript})

    except Exception as e:
        import traceback
        logger.error("Transcription FAILED (total=%.3fs): %s\n%s",
                    time.perf_counter() - t_total, e, traceback.format_exc())
        return jsonify({
            "ok": False,
            "error": f"Transcription failed: {str(e)}"
        }), 500
    finally:
        t_clean = time.perf_counter()
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
                logger.info("Cleaned up temp file: %s", temp_path)
                logger.debug("transcribe cleanup=%.3fs", time.perf_counter() - t_clean)
        except Exception as cleanup_err:
            logger.error("Failed to remove temp audio file: %s", cleanup_err)


def _ask_ai_default_language(user_obj) -> str:
    """Pick the TTS/LLM language for an Ask AI response.

    Prefers the user's first configured study language, falling back to en_US.
    """
    langs = getattr(user_obj, "languages", None) or []
    for lang_obj in langs:
        if lang_obj and lang_obj.language:
            return lang_obj.language
    return "en_US"

def _build_ask_ai_prompt(
    transcript, question_text, answer_text, categories, language,
    history=None, image_urls=None,
):
    """Build the tutor-style LLM messages for an Ask AI request.

    Images are attached to the FIRST user message as OpenAI-style content blocks
    (LiteLLM normalises this across providers), so a multi-turn conversation does
    not re-upload them on every follow-up.
    """
    if history is None:
        history = []
    if image_urls is None:
        image_urls = []

    categories_csv = ", ".join(categories) if categories else "(none provided)"
    if answer_text:
        answer_section = ANSWER_SECTION_REVEALED.format(answer=answer_text)
    else:
        answer_section = ANSWER_SECTION_NOT_REVEALED

    def _first_user_message(first_transcript):
        text = USER_PROMPT.format(
            question=question_text or "(no question text provided)",
            categories=categories_csv,
            answer_section=answer_section,
            transcript=first_transcript,
        )
        if not image_urls:
            return {"role": "user", "content": text}
        content = [{"type": "text", "text": text}]
        for url in image_urls:
            content.append({"type": "image_url", "image_url": {"url": url}})
        return {"role": "user", "content": content}

    if not history:
        return [
            {"role": "system", "content": SYSTEM_PROMPT},
            _first_user_message(transcript),
        ]

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Format the first user interaction with the full template and context
    first_item = history[0]
    messages.append(_first_user_message(first_item.get("transcript") or ""))
    messages.append({"role": "assistant", "content": first_item.get("answer") or ""})

    # Append subsequent QA pairs in order
    for item in history[1:]:
        messages.append({"role": "user", "content": item.get("transcript") or ""})
        messages.append({"role": "assistant", "content": item.get("answer") or ""})

    # Append current transcript as the new user message
    messages.append({"role": "user", "content": transcript})
    return messages


@ai.route("/api/ask-ai", methods=["POST"])
@login_required
def ask_ai():
    """Phase 2 step 1: turn a transcribed Ask AI question into a tutor text answer.

    This endpoint only calls the LLM. Synthesis of the spoken audio is a separate
    step (/api/ask-ai/speak) so the frontend can show distinct progress phases
    ("Thinking" then "Transcribing: Answer") and the user can see which step is slow.

    Accepts JSON:
      - transcript (required): the user's transcribed spoken question
      - question_text (required): the current quiz question text
      - question_id (required): the current quiz question id (kept for context/logging)
      - answer_text (optional): the current answer text, only if already revealed
      - categories (optional): list of category names
      - image_urls / image_ids (optional): stubbed in Phase 2

    Returns JSON:
      - ok: bool
      - answer_text: the LLM tutor response (plain text)
      - language: the language used (for the follow-up speak request)

    Nothing here persists to S3 or the `audio` table; Ask AI conversations are
    ephemeral. The existing question/answer/hint TTS pipeline is unaffected.
    """
    logger = logging.getLogger(__name__ + ".ask_ai")
    import time
    t_total = time.perf_counter()
    logger.info("=== ASK AI REQUEST START ===")

    data = request.get_json(silent=True) or {}

    transcript = (data.get("transcript") or "").strip()
    question_text = (data.get("question_text") or "").strip()
    raw_question_id = data.get("question_id")
    answer_text = (data.get("answer_text") or "").strip() or None
    categories = data.get("categories") or []
    history = data.get("history") or []
    image_urls = _sanitize_image_urls(data.get("image_urls") or [])

    if not transcript:

        return jsonify({"ok": False, "error": "Missing 'transcript'."}), 400
    if not question_text:
        return jsonify({"ok": False, "error": "Missing 'question_text'."}), 400

    # A question being created on /addcontent has no id yet. The id is
    # only used for logging, so treat it as optional rather than rejecting.
    try:
        question_id = int(raw_question_id)
    except (TypeError, ValueError):
        question_id = None

    try:
        t_user = time.perf_counter()
        user_obj = session.execute(
            select(users).where(users.id == current_user.id)
        ).scalar_one()
        logger.debug("ask_ai user_lookup=%.3fs", time.perf_counter() - t_user)
    except Exception as e:
        logger.error("Failed to load user for Ask AI: %s", e)
        return jsonify({"ok": False, "error": "Failed to load user."}), 500

    # Route to the vision model ONLY when images are attached
    modality = "text"
    if image_urls:
        if not _modality_is_configured(user_obj, IMAGE_MODALITY):
            return jsonify({
                "ok": False,
                "error": (
                    "Sending images requires a vision-capable model configured for "
                    "the 'image' modality on your profile page. Set one up, or untick "
                    "the image checkbox to ask without images."
                ),
            }), 400
        modality = IMAGE_MODALITY

    t_lang = time.perf_counter()
    language = _ask_ai_default_language(user_obj)
    logger.debug("ask_ai _ask_ai_default_language=%.3fs -> %s", time.perf_counter() - t_lang, language)
    logger.info("Ask AI user id=%d, question_id=%s, language=%s, modality=%s, images=%d",
                user_obj.id, question_id, language, modality, len(image_urls))

    t_prompt = time.perf_counter()
    messages = _build_ask_ai_prompt(
        transcript=transcript,
        question_text=question_text,
        answer_text=answer_text,
        categories=categories,
        language=language,
        history=history,
        image_urls=image_urls,
    )
    logger.debug("ask_ai _build_ask_ai_prompt=%.3fs", time.perf_counter() - t_prompt)

    # Get the tutor-style text answer from the LLM.
    try:
        t_llm = time.perf_counter()
        resp = completion_for_user(user_obj, messages=messages, modality=modality, temperature=0.4)
        logger.info("[BOTTLENECK CANDIDATE] ask_ai completion_for_user=%.3fs", time.perf_counter() - t_llm)
        choices = getattr(resp, "choices", None)
        if choices:
            answer = choices[0]["message"]["content"]
        else:
            answer = resp["choices"][0]["message"]["content"]
    except AIConfigError as e:
        logger.warning("Ask AI AIConfigError: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        import traceback
        logger.error("Ask AI LLM call FAILED: %s\n%s", e, traceback.format_exc())
        return jsonify({"ok": False, "error": f"AI request failed: {e}"}), 500

    answer = (answer or "").strip()
    if not answer:
        return jsonify({"ok": False, "error": "AI returned an empty response."}), 502

    logger.info("Ask AI LLM answer (%d chars): %r", len(answer), answer[:120])
    logger.info("=== ASK AI REQUEST SUCCESS (total=%.3fs) ===", time.perf_counter() - t_total)
    return jsonify({
        "ok": True,
        "answer_text": answer,
        "language": language,
    })


@ai.route("/api/ask-ai/speak", methods=["POST"])
@login_required
def ask_ai_speak():
    """Phase 2 step 2: synthesize (ephemeral) spoken audio for an Ask AI answer.

    Accepts JSON:
      - text (required): the text to speak (the LLM answer from /api/ask-ai)
      - language (optional): TTS language; defaults to the user's first study language

    Returns JSON:
      - ok: bool
      - audio_b64: the Piper-generated MP3, base64-encoded, or null on failure
      - audio_content_type: "audio/mpeg"
      - warning (optional): present if TTS failed

    Nothing is persisted to S3 or the `audio` table. Only the real
    question/answer/hint pipeline writes/stored audio; this is purely ephemeral.
    """
    logger = logging.getLogger(__name__ + ".ask_ai_speak")
    import time
    t_total = time.perf_counter()
    logger.info("=== ASK AI SPEAK REQUEST START ===")

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    language = (data.get("language") or "").strip() or None

    if not text:
        return jsonify({"ok": False, "error": "Missing 'text'."}), 400

    if not language:
        try:
            user_obj = session.execute(
                select(users).where(users.id == current_user.id)
            ).scalar_one()
            language = _ask_ai_default_language(user_obj)
        except Exception as e:
            logger.error("Failed to load user for Ask AI speak: %s", e)
            return jsonify({"ok": False, "error": "Failed to load user."}), 500

    try:
        import base64
        from ..audio.audio import TTSClientAdapter

        t_tts = time.perf_counter()
        tts_client = TTSClientAdapter()
        audio_bytes, _metadata = tts_client.create_audio(text=text, language=language)
        logger.info("[BOTTLENECK CANDIDATE] ask_ai_speak TTSClientAdapter.create_audio=%.3fs (audio_bytes=%d)",
                    time.perf_counter() - t_tts, len(audio_bytes) if audio_bytes else 0)
        t_b64 = time.perf_counter()
        audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
        logger.debug("ask_ai_speak base64encode=%.3fs", time.perf_counter() - t_b64)
    except Exception as e:
        import traceback
        logger.error("Ask AI TTS generation FAILED: %s\n%s", e, traceback.format_exc())
        return jsonify({
            "ok": True,
            "audio_b64": None,
            "audio_content_type": "audio/mpeg",
            "warning": f"TTS generation failed: {e}",
        })

    logger.info("=== ASK AI SPEAK REQUEST SUCCESS (total=%.3fs) ===", time.perf_counter() - t_total)
    return jsonify({
        "ok": True,
        "audio_b64": audio_b64,
        "audio_content_type": "audio/mpeg",
    })

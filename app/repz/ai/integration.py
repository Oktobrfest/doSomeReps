"""AI Integration page.

Provides API endpoints for retrieving, saving, and testing AI configurations using React.
"""

import logging
from flask import jsonify, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import select, delete

from repz.routes import ai
from ..database import session
from ..models import users, UserAIProvider, UserAIIntegration
from .litellm_client import completion_for_user, AIConfigError, price_label
from .profile_forms import PREDEFINED_OPTIONS


@ai.route("/integration", methods=["GET"])
@login_required
def ai_integration():
    """Redirect to the profile page which now embeds the AI Integration application."""
    from flask import redirect, url_for
    return redirect(url_for("ai.profile"))


@ai.route("/integration/api/config", methods=["GET"])
@login_required
def get_ai_config():
    """API endpoint to get the current user's AI configuration."""
    try:
        user_obj = session.execute(
            select(users).where(users.id == current_user.id)
        ).scalar_one()

        # Load saved providers
        providers_list = []
        for prov in user_obj.ai_providers:
            has_key = bool(prov.api_key)
            masked_key = "••••••••••••••••" if has_key else ""
            providers_list.append({
                "id": prov.id,
                "provider": prov.provider,
                "apiBase": prov.api_base or "",
                "hasKey": has_key,
                "maskedKey": masked_key,
            })

        # Load saved integrations
        integrations_list = []
        for integ in user_obj.ai_integrations:
            integrations_list.append({
                "id": integ.id,
                "modality": integ.modality,
                "provider_id": integ.provider_id,
                "model": integ.model or "",
            })

        # Fallback for legacy single-config representation
        has_key_legacy = bool(user_obj.ai_api_key)
        masked_key_legacy = "••••••••••••••••" if has_key_legacy else ""

        prices = {}
        for prov, models in PREDEFINED_OPTIONS.items():
            for m in models:
                if m:
                    price = price_label(m, prov)
                    prices[m] = price
                    prices[m.lower()] = price

        # Ensure any custom configured models also have price entries
        all_models = [user_obj.ai_model] if user_obj.ai_model else []
        for integ in user_obj.ai_integrations:
            if integ.model:
                all_models.append(integ.model)

        for m in all_models:
            if m and m not in prices and m.lower() not in prices:
                # Find associated provider
                prov = user_obj.ai_provider
                if "/" in m:
                    parts = m.split("/", 1)
                    price = price_label(parts[1], parts[0])
                else:
                    price = price_label(m, prov)
                prices[m] = price
                prices[m.lower()] = price

        result_data = {
            # Legacy fields for backward compatibility
            "provider": user_obj.ai_provider or "",
            "model": user_obj.ai_model or "",
            "apiBase": user_obj.ai_api_base or "",
            "hasKey": has_key_legacy,
            "maskedKey": masked_key_legacy,

            # New multi-modality lists
            "providers": providers_list,
            "integrations": integrations_list,

            "predefinedOptions": PREDEFINED_OPTIONS,
            "modelPrices": prices
        }

        response = jsonify(result_data)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        return response
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to load configuration: {str(e)}"
        }), 500


@ai.route("/integration/api/provider", methods=["POST"])
@login_required
def save_ai_provider():
    """API endpoint to save/update a user's AI provider API key and details."""
    data = request.get_json() or {}
    try:
        provider_name = (data.get("provider") or "").strip()
        api_base = (data.get("apiBase") or "").strip() or None
        api_key = (data.get("apiKey") or "").strip()

        if not provider_name:
            return jsonify({"success": False, "error": "Provider name is required"}), 400

        # Check if provider already exists for the user
        prov_obj = next((p for p in current_user.ai_providers if p.provider == provider_name), None)

        if not prov_obj:
            prov_obj = UserAIProvider(
                user_id=current_user.id,
                provider=provider_name,
                api_base=api_base,
            )
            session.add(prov_obj)
        else:
            prov_obj.api_base = api_base

        if api_key:
            prov_obj.api_key = api_key

        session.commit()
        return jsonify({
            "success": True,
            "message": f"Successfully updated credentials for {provider_name.upper()}!"
        })
    except Exception as e:
        session.rollback()
        return jsonify({
            "success": False,
            "error": f"Failed to save provider: {str(e)}"
        }), 500


@ai.route("/integration/api/provider/<int:provider_id>", methods=["DELETE"])
@login_required
def delete_ai_provider(provider_id):
    """API endpoint to delete a provider config."""
    try:
        session.execute(
            delete(UserAIProvider).where(
                UserAIProvider.id == provider_id,
                UserAIProvider.user_id == current_user.id
            )
        )
        session.commit()
        return jsonify({
            "success": True,
            "message": "Provider credentials successfully deleted!"
        })
    except Exception as e:
        session.rollback()
        return jsonify({
            "success": False,
            "error": f"Failed to delete provider: {str(e)}"
        }), 500


@ai.route("/integration/api/integration", methods=["POST"])
@login_required
def save_ai_integration():
    """API endpoint to save/update a user's AI integration model & provider mapping for a modality."""
    data = request.get_json() or {}
    try:
        modality = (data.get("modality") or "").strip()
        provider_id = data.get("provider_id")
        model = (data.get("model") or "").strip()

        if not modality:
            return jsonify({"success": False, "error": "Modality is required"}), 400

        # Check if configuration already exists for this modality
        integ_obj = next((i for i in current_user.ai_integrations if i.modality == modality), None)

        if not integ_obj:
            integ_obj = UserAIIntegration(
                user_id=current_user.id,
                modality=modality,
            )
            session.add(integ_obj)

        integ_obj.provider_id = provider_id if provider_id else None
        integ_obj.model = model or None

        session.commit()
        return jsonify({
            "success": True,
            "message": f"Successfully saved configuration for {modality.upper()} modality!"
        })
    except Exception as e:
        session.rollback()
        return jsonify({
            "success": False,
            "error": f"Failed to save integration: {str(e)}"
        }), 500


@ai.route("/integration/api/integration/<int:integration_id>", methods=["DELETE"])
@login_required
def delete_ai_integration(integration_id):
    """API endpoint to delete a modality integration config."""
    try:
        session.execute(
            delete(UserAIIntegration).where(
                UserAIIntegration.id == integration_id,
                UserAIIntegration.user_id == current_user.id
            )
        )
        session.commit()
        return jsonify({
            "success": True,
            "message": "Modality integration cleared successfully!"
        })
    except Exception as e:
        session.rollback()
        return jsonify({
            "success": False,
            "error": f"Failed to clear integration: {str(e)}"
        }), 500


@ai.route("/integration/api/config", methods=["POST"])
@login_required
def save_ai_config():
    """Legacy API endpoint to save the user's primary AI configuration (for compatibility)."""
    data = request.get_json() or {}

    try:
        user_obj = session.execute(
            select(users).where(users.id == current_user.id)
        ).scalar_one()

        provider = (data.get("provider") or "").strip()
        model = (data.get("model") or "").strip()
        api_base = (data.get("apiBase") or "").strip()
        api_key = (data.get("apiKey") or "").strip()

        user_obj.ai_provider = provider or None
        user_obj.ai_model = model or None
        user_obj.ai_api_base = api_base or None

        if api_key:
            user_obj.ai_api_key = api_key

        session.commit()

        return jsonify({
            "success": True,
            "message": "AI settings successfully updated!"
        })
    except Exception as e:
        session.rollback()
        return jsonify({
            "success": False,
            "error": f"Failed to save configuration: {str(e)}"
        }), 500


@ai.route("/integration/api/config/key", methods=["DELETE"])
@login_required
def delete_ai_api_key():
    """Legacy API endpoint to delete the user's saved API key (for compatibility)."""
    try:
        user_obj = session.execute(
            select(users).where(users.id == current_user.id)
        ).scalar_one()

        user_obj.ai_api_key = None
        session.commit()

        return jsonify({
            "success": True,
            "message": "AI API Key successfully deleted!"
        })
    except Exception as e:
        session.rollback()
        return jsonify({
            "success": False,
            "error": f"Failed to delete API key: {str(e)}"
        }), 500


@ai.route("/integration/api/test", methods=["POST"])
@login_required
def test_ai_completion():
    """API endpoint to test AI completion using user's saved settings."""
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    modality = (data.get("modality") or "text").strip()

    if not prompt:
        return jsonify({"success": False, "error": "Prompt cannot be empty."}), 400

    user_obj = session.execute(
        select(users).where(users.id == current_user.id)
    ).scalar_one()

    try:
        messages = [
            {"role": "system", "content": "You are a helpful assistant validating this AI integration works correctly."},
            {"role": "user", "content": prompt}
        ]

        resp = completion_for_user(user_obj, messages=messages, modality=modality, temperature=0.7)
        choices = getattr(resp, "choices", [])
        content = choices[0]["message"]["content"] if choices else ""

        # Find model used based on integration/modality or fallback to legacy
        model_used = None
        integration = next((i for i in user_obj.ai_integrations if i.modality == modality), None)
        if integration:
            model_used = integration.model
        if not model_used:
            model_used = user_obj.ai_model

        model_used = getattr(resp, "model", model_used)

        return jsonify({
            "success": True,
            "response": content,
            "model_used": model_used
        })
    except AIConfigError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        import traceback
        logging.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": f"An error occurred while connecting to the AI provider: {str(e)}"
        }), 500


TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe"


def _resolve_stt_config(user_obj):
    """Return (api_key, api_base, model) for STT transcription."""
    integration = next((i for i in user_obj.ai_integrations if i.modality == "stt"), None)
    if integration and integration.provider_relation:
        return (
            integration.provider_relation.api_key,
            integration.provider_relation.api_base or None,
            integration.model or TRANSCRIBE_MODEL,
        )
    return (
        getattr(user_obj, "ai_api_key", None),
        getattr(user_obj, "ai_api_base", None),
        TRANSCRIBE_MODEL,
    )


@ai.route("/api/ask-ai/transcribe", methods=["POST"])
@login_required
def ask_ai_transcribe():
    """API endpoint to transcribe Ask AI audio questions."""
    import os
    import tempfile

    logger = logging.getLogger(__name__ + ".transcribe")
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

    user_obj = session.execute(
        select(users).where(users.id == current_user.id)
    ).scalar_one()
    logger.info("User id=%d, loaded OK", user_obj.id)

    api_key, api_base, model = _resolve_stt_config(user_obj)
    logger.info("STT config: model=%r api_base=%r has_key=%s",
                model, api_base, bool(api_key))

    if not api_key:
        logger.warning("No API key configured for STT")
        return jsonify({"ok": False, "error": "AI API Key not configured. Please set one on your profile page."}), 400

    # Save to a safe temporary file
    fd, temp_path = tempfile.mkstemp(suffix=".webm")
    logger.info("Temp file path: %s", temp_path)

    try:
        with os.fdopen(fd, "wb") as tmp:
            audio_file.save(tmp)

        file_size = os.path.getsize(temp_path)
        logger.info("Saved audio to disk, size=%d bytes", file_size)

        if file_size == 0:
            logger.warning("Audio file is empty on disk")
            return jsonify({"ok": False, "error": "Audio file is empty."}), 400

        # Use the OpenAI client directly instead of litellm.transcription()
        # because LiteLLM's transcription handler strips the "openai/" prefix
        # from the model name before sending it in the JSON body.  Providers
        # like DeepInfra require the full "openai/whisper-large-v3" string
        # as the model parameter, so we must bypass LiteLLM for STT.
        from openai import OpenAI

        client_kwargs: dict = {"api_key": api_key}
        if api_base:
            # The OpenAI-compatible audio endpoint is underneath api_base.
            # api_base is e.g. "https://api.deepinfra.com/v1/openai"
            client_kwargs["base_url"] = api_base.rstrip("/")

        logger.info("OpenAI client base_url=%s", client_kwargs.get("base_url"))

        client = OpenAI(**client_kwargs)

        logger.info("Calling client.audio.transcriptions.create with model=%r", model)
        with open(temp_path, "rb") as f:
            resp = client.audio.transcriptions.create(
                model=model,
                file=f,
            )

        # resp is an object with a .text attribute (standard openai shape)
        transcript = resp.text if hasattr(resp, "text") else str(resp)
        logger.info("Transcription result: %r", transcript)

        logger.info("=== TRANSCRIBE REQUEST SUCCESS ===")
        return jsonify({"ok": True, "transcript": transcript})

    except Exception as e:
        import traceback
        logger.error("Transcription FAILED: %s\n%s", e, traceback.format_exc())
        return jsonify({
            "ok": False,
            "error": f"Transcription failed: {str(e)}"
        }), 500
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
                logger.info("Cleaned up temp file: %s", temp_path)
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


def _build_ask_ai_prompt(transcript, question_text, answer_text, categories, language):
    """Build the tutor-style LLM messages for an Ask AI request."""
    categories_csv = ", ".join(categories) if categories else "(none provided)"
    if answer_text:
        answer_section = (
            "The user has already revealed the answer to this question, which is shown below. "
            "You may reference it to help explain, but keep coaching them to understand it.\n"
            "Answer:\n{answer}\n\n"
        ).format(answer=answer_text)
    else:
        answer_section = (
            "The user has not revealed the answer yet. Do NOT state or reveal the answer "
            "unless they directly ask for it. Help them to think.\n\n"
        )

    system_prompt = (
        "You are a friendly, encouraging tutor helping a student who is studying a "
        "spaced-repetition quiz question.\n\n"
        "Your job is to teach, not to grade. Never tell the student whether their guess "
        "is correct or incorrect, and do not score them.\n\n"
        "Guidelines:\n"
        "1. Answer the student's spoken question clearly and concisely, as a tutor would.\n"
        "2. If the transcript is unclear or too ambiguous to answer, ask one short "
        "clarifying question and stop.\n"
        "3. Keep explanations focused and digestible for spoken audio: short sentences, "
            "plain language, no Markdown, no tables, no code blocks.\n"
        "4. Do not include labels like 'Answer:' or 'Tutor:'. Output only the words to be "
            "spoken aloud.\n"
        "5. Respond in the same language as the question. If the question is in English "
            "(or the language is ambiguous), respond in English. The target answer "
            "language is: {language}.\n"
        "6. Treat any provided images as context only; you cannot see them, so do not "
            "pretend to.\n"
    ).format(language=language)

    user_prompt = (
        "The student is currently studying this quiz question.\n\n"
        "Question:\n{question}\n\n"
        "Categories: {categories}\n\n"
        "{answer_section}"
        "The student's spoken question (transcribed) is:\n{transcript}\n\n"
        "Provide a short, spoken-friendly tutor response."
    ).format(
        question=question_text or "(no question text provided)",
        categories=categories_csv,
        answer_section=answer_section,
        transcript=transcript,
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


@ai.route("/api/ask-ai", methods=["POST"])
@login_required
def ask_ai():
    """Phase 2: turn a transcribed Ask AI question into a spoken tutor answer.

    Accepts JSON:
      - transcript (required): the user's transcribed spoken question
      - question_text (required): the current quiz question text
      - question_id (required): the current quiz question id (used for audio storage)
      - answer_text (optional): the current answer text, only if already revealed
      - categories (optional): list of category names
      - image_urls / image_ids (optional): stubbed in Phase 2

    Returns JSON:
      - ok: bool
      - answer_text: the LLM tutor response (plain text)
      - audio_url: a local URL serving the Piper-generated MP3 for the answer
    """
    logger = logging.getLogger(__name__ + ".ask_ai")
    logger.info("=== ASK AI REQUEST START ===")

    data = request.get_json(silent=True) or {}

    transcript = (data.get("transcript") or "").strip()
    question_text = (data.get("question_text") or "").strip()
    raw_question_id = data.get("question_id")
    answer_text = (data.get("answer_text") or "").strip() or None
    categories = data.get("categories") or []
    image_urls = data.get("image_urls") or data.get("image_ids") or []

    if image_urls:
        logger.info("Ask AI received image context (stubbed in Phase 2): %d image(s)", len(image_urls))

    if not transcript:
        return jsonify({"ok": False, "error": "Missing 'transcript'."}), 400
    if not question_text:
        return jsonify({"ok": False, "error": "Missing 'question_text'."}), 400

    try:
        question_id = int(raw_question_id)
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "Missing or invalid 'question_id'."}), 400

    try:
        user_obj = session.execute(
            select(users).where(users.id == current_user.id)
        ).scalar_one()
    except Exception as e:
        logger.error("Failed to load user for Ask AI: %s", e)
        return jsonify({"ok": False, "error": "Failed to load user."}), 500

    language = _ask_ai_default_language(user_obj)
    logger.info("Ask AI user id=%d, question_id=%s, language=%s", user_obj.id, question_id, language)

    messages = _build_ask_ai_prompt(
        transcript=transcript,
        question_text=question_text,
        answer_text=answer_text,
        categories=categories,
        language=language,
    )

    # Step 1: get the tutor-style text answer from the LLM.
    try:
        resp = completion_for_user(user_obj, messages=messages, modality="text", temperature=0.4)
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

    # Step 2: synthesize spoken audio from the answer using the existing Piper/Hatchet TTS pipeline.
    try:
        from ..audio.audio import TTSClientAdapter
        from ..services.audio_asset_service import AudioAssetService, S3StorageClient

        tts_client = TTSClientAdapter()
        storage_client = S3StorageClient()
        audio_service = AudioAssetService(tts_client, storage_client)

        object_key = audio_service._audio_object_key(
            question_id=question_id,
            part="ask-ai",
            language=language,
            source_text=answer,
        )

        audio_service.ensure_audio(
            question_id=question_id,
            part="ask-ai",
            language=language,
            source_text=answer,
            tts_text=answer,
        )

        audio_url = url_for("audio.serve_audio_by_key", object_key=object_key)
    except Exception as e:
        import traceback
        logger.error("Ask AI TTS/audio save FAILED: %s\n%s", e, traceback.format_exc())
        return jsonify({
            "ok": True,
            "answer_text": answer,
            "audio_url": None,
            "warning": f"TTS generation failed: {e}",
        })

    logger.info("=== ASK AI REQUEST SUCCESS ===")
    return jsonify({
        "ok": True,
        "answer_text": answer,
        "audio_url": audio_url,
    })

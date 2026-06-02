"""AI Integration page.

Provides API endpoints for retrieving, saving, and testing AI configurations using React.
"""

import logging
from flask import jsonify, render_template, request
from flask_login import current_user, login_required
from sqlalchemy import select

from repz.routes import ai
from ..database import session
from ..models import users
from .litellm_client import completion_for_user, AIConfigError
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

        # Determine if key is set
        has_key = bool(user_obj.ai_api_key)
        masked_key = "••••••••••••••••" if has_key else ""

        # Build prices for all models in PREDEFINED_OPTIONS
        from app.repz.ai.litellm_client import price_label
        
        logging.info("=== BUILDING PRICE MAP ===")
        logging.info(f"User model: {user_obj.ai_model}, provider: {user_obj.ai_provider}")
        
        prices = {}
        for prov, models in PREDEFINED_OPTIONS.items():
            logging.debug(f"Processing provider: {prov} with {len(models)} models")
            for m in models:
                if m:
                    price = price_label(m, prov)
                    # Store with original key
                    prices[m] = price
                    # Also store with lowercase key
                    prices[m.lower()] = price
                    logging.debug(f"Mapped {m} and {m.lower()} -> {price}")

        # Ensure current model has a price entry
        if user_obj.ai_model and user_obj.ai_model not in prices:
            logging.info(f"Current model {user_obj.ai_model} not in prices, adding it")
            m = user_obj.ai_model
            prov = user_obj.ai_provider
            if "/" in m:
                parts = m.split("/", 1)
                price = price_label(parts[1], parts[0])
            else:
                price = price_label(m, prov)
            
            # Store with both original and lowercase keys
            prices[m] = price
            prices[m.lower()] = price
            logging.debug(f"Added current model: {m} and {m.lower()} -> {price}")
        
        logging.info(f"Final price map has {len(prices)} entries")

        result_data = {
            "provider": user_obj.ai_provider or "",
            "model": user_obj.ai_model or "",
            "apiBase": user_obj.ai_api_base or "",
            "hasKey": has_key,
            "maskedKey": masked_key,
            "predefinedOptions": PREDEFINED_OPTIONS,
            "modelPrices": prices
        }
        
        logging.info(f"Returning config with {len(prices)} price entries")
        logging.debug(f"Sample prices: {list(prices.items())[:5]}")
        
        response = jsonify(result_data)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        return response
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to load configuration: {str(e)}"
        }), 500


@ai.route("/integration/api/config", methods=["POST"])
@login_required
def save_ai_config():
    """API endpoint to save the user's AI configuration."""
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

        # Only overwrite key if provided
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
    """API endpoint to delete the user's saved API key."""
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
        
        resp = completion_for_user(user_obj, messages=messages, temperature=0.7)
        choices = getattr(resp, "choices", [])
        content = choices[0]["message"]["content"] if choices else ""
        model_used = getattr(resp, "model", user_obj.ai_model)
        
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

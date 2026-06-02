"""Thin wrapper around LiteLLM that pulls per-user provider settings
from the `users` row.

Usage:
    from repz.ai.litellm_client import completion_for_user

    resp = completion_for_user(
        user,
        messages=[{"role": "user", "content": "Hello"}],
    )
    text = resp["choices"][0]["message"]["content"]

Why LiteLLM: it gives us a single `completion()` call that works
across OpenAI, Anthropic (Claude), Google Gemini, Vertex AI, Azure,
Bedrock, Cohere, Mistral, Groq, OpenRouter, Ollama, and ~100 more
providers, just by routing on the "<provider>/<model>" model id.
See https://docs.litellm.ai/docs/providers
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from litellm import litellm


class AIConfigError(RuntimeError):
    """Raised when the current user hasn't finished configuring AI."""


def _build_model_id(provider: Optional[str], model: Optional[str]) -> str:
    """Combine provider + model into the canonical LiteLLM model id."""
    if not model:
        raise AIConfigError("No AI model configured for this user.")
    if not provider:
        return model
    # Only skip prefixing if it's ALREADY prefixed with THIS provider —
    # don't be fooled by slashes inside the model name (e.g. DeepInfra's
    # "deepseek-ai/DeepSeek-V3.2").
    if model.startswith(provider + "/"):
        return model
    return f"{provider}/{model}"


def completion_for_user(user, messages: List[Dict[str, str]], **kwargs: Any):
    """Call `litellm.completion` using the given user's saved settings.

    `user` must be a `repz.models.users` instance with `ai_provider`,
    `ai_model`, `ai_api_key` and (optionally) `ai_api_base` populated.

    Any extra kwargs are forwarded to `litellm.completion` as-is, so
    callers can pass `temperature`, `max_tokens`, `stream`, etc.
    """
    # Imported lazily so the rest of the app keeps working even if
    # litellm hasn't been installed yet (e.g. dev environments that
    # haven't pip-installed the new requirement).
    import litellm

    api_key = getattr(user, "ai_api_key", None)
    if not api_key:
        raise AIConfigError(
            "No API key configured. Set one on your profile page."
        )

    model_id = _build_model_id(
        getattr(user, "ai_provider", None),
        getattr(user, "ai_model", None),
    )

    call_kwargs: Dict[str, Any] = {
        "model": model_id,
        "messages": messages,
        "api_key": api_key,
    }
    api_base = getattr(user, "ai_api_base", None)
    if api_base:
        call_kwargs["api_base"] = api_base
    call_kwargs.update(kwargs)

    return litellm.completion(**call_kwargs)


def price_label(model_name, provider=None):
    """Best-effort '$in / $out per 1M tokens' string, or '' if unknown.
    
    This function tries multiple lookup strategies with normalization to find
    pricing information in litellm.model_cost.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.debug(f"=== PRICE_LABEL DEBUG ===")
    logger.debug(f"Input - model_name: {model_name}, provider: {provider}")
    
    if not model_name:
        logger.debug("No model_name provided")
        return ""
    
    # Normalize inputs
    model_normalized = model_name.strip().lower()
    provider_normalized = provider.strip().lower() if provider else None
    
    logger.debug(f"Normalized - model: {model_normalized}, provider: {provider_normalized}")
    
    # Build list of keys to try (both original case and lowercase)
    keys = [
        model_name,  # Original case
        model_normalized,  # Lowercase
        model_name.split("/")[-1],  # Bare name (original case)
        model_normalized.split("/")[-1],  # Bare name (lowercase)
    ]
    
    if provider:
        keys.extend([
            f"{provider}/{model_name}",  # Original case with provider
            f"{provider_normalized}/{model_normalized}",  # Lowercase with provider
        ])
    
    # Also try extracting provider from model if it contains /
    if "/" in model_name:
        parts = model_name.split("/", 1)
        extracted_provider = parts[0]
        extracted_model = parts[1]
        keys.extend([
            extracted_model,  # Just the model part
            extracted_model.lower(),  # Lowercase model part
            f"{extracted_provider.lower()}/{extracted_model.lower()}",  # Fully lowercase
        ])
    
    logger.debug(f"Trying lookup keys: {keys}")
    
    # Try each key, checking both exact match and case-insensitive match
    for key in keys:
        # Try exact match first
        info = litellm.model_cost.get(key)
        if info:
            logger.debug(f"✓ Found pricing with exact match key: {key}")
            cin = info.get("input_cost_per_token")
            cout = info.get("output_cost_per_token")
            if cin is not None and cout is not None:
                result = f"${cin * 1e6:.2f} / ${cout * 1e6:.2f} per 1M tokens"
                logger.debug(f"Returning: {result}")
                return result
            if cin is not None:
                result = f"${cin * 1e6:.2f} per 1M tokens"
                logger.debug(f"Returning: {result}")
                return result
        
        # Try case-insensitive match
        lower_key = key.lower()
        for cost_key in litellm.model_cost.keys():
            if cost_key.lower() == lower_key:
                info = litellm.model_cost.get(cost_key)
                if info:
                    logger.debug(f"✓ Found pricing with case-insensitive match: {cost_key}")
                    cin = info.get("input_cost_per_token")
                    cout = info.get("output_cost_per_token")
                    if cin is not None and cout is not None:
                        result = f"${cin * 1e6:.2f} / ${cout * 1e6:.2f} per 1M tokens"
                        logger.debug(f"Returning: {result}")
                        return result
                    if cin is not None:
                        result = f"${cin * 1e6:.2f} per 1M tokens"
                        logger.debug(f"Returning: {result}")
                        return result
    
    logger.debug(f"✗ No pricing found for model {model_name}")
    return ""

def build_price_map(choices, provider=None):
    """choices = form.ai_model.choices  ->  {model_value: price_string}
    
    Returns a dict with both original keys and normalized lowercase keys
    to ensure the frontend can find prices regardless of case.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.debug(f"=== BUILD_PRICE_MAP DEBUG ===")
    logger.debug(f"Provider: {provider}, Choices count: {len(choices) if choices else 0}")
    
    price_map = {}
    for value, _ in choices:
        if value:
            price = price_label(value, provider)
            # Store with original key
            price_map[value] = price
            # Also store with lowercase key for easier lookup
            price_map[value.lower()] = price
            logger.debug(f"Mapped {value} and {value.lower()} -> {price}")
    
    logger.debug(f"Final price_map has {len(price_map)} entries")
    return price_map

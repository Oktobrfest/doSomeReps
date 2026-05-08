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


class AIConfigError(RuntimeError):
    """Raised when the current user hasn't finished configuring AI."""


def _build_model_id(provider: Optional[str], model: Optional[str]) -> str:
    """Combine provider + model into the canonical LiteLLM model id.

    LiteLLM accepts plain model names like "gpt-4" for OpenAI, but for
    everything else it expects "<provider>/<model>", e.g.
    "anthropic/claude-3-5-sonnet-20240620" or "gemini/gemini-1.5-pro".
    Always emitting the prefix is unambiguous and provider-agnostic.
    """
    if not model:
        raise AIConfigError("No AI model configured for this user.")
    if not provider:
        # No provider set - assume the model id is already fully
        # qualified (or an OpenAI default like "gpt-4").
        return model
    # If the user already typed "provider/model" in the model field,
    # don't double-prefix it.
    if "/" in model:
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

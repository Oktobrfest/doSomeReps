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
import logging
logger = logging.getLogger(__name__)

# Prevent LiteLLM cost calculation exceptions/warnings for unmapped models
class DefaultingModelCost(dict):
    def __getitem__(self, key):
        if key not in self:
            return {
                "max_tokens": 8192,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "litellm_provider": "custom",
                "mode": "chat"
            }
        return super().__getitem__(key)

    def get(self, key, default=None):
        if key not in self:
            return {
                "max_tokens": 8192,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "litellm_provider": "custom",
                "mode": "chat"
            }
        return super().get(key, default)

litellm.model_cost = DefaultingModelCost(litellm.model_cost or {})
litellm.suppress_warnings = True
litellm.drop_params = True

CUSTOM_MODEL_PRICES = {
    # OpenAI
    "openai/gpt-5-nano": (0.05, 0.40),
    "openai/gpt-5.4-nano": (0.20, 0.20),
    "openai/gpt-5.4-mini": (0.75, 0.75),
    "openai/gpt-5.4": (2.50, 15.00),
    "openai/gpt-5.5": (5.00, 30.00),
    "gpt-5-nano": (0.05, 0.40),
    "gpt-5.4-nano": (0.20, 0.20),
    "gpt-5.4-mini": (0.75, 0.75),
    "gpt-5.4": (2.50, 15.00),
    "gpt-5.5": (5.00, 30.00),

    # Anthropic
    "anthropic/claude-haiku-4-5": (1.00, 5.00),
    "anthropic/claude-sonnet-4-6": (3.00, 15.00),
    "anthropic/claude-opus-4-7": (5.00, 25.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-opus-4-7": (5.00, 25.00),

    # Gemini
    "gemini/gemini-2.5-flash-lite": (0.10, 0.40),
    "gemini/gemini-2.5-flash": (0.30, 2.50),
    "gemini/gemini-2.5-pro": (1.25, 5.00),
    "gemini/gemini-3-pro": (2.00, 12.00),
    "gemini-2.5-flash-lite": (0.10, 0.40),
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-2.5-pro": (1.25, 5.00),
    "gemini-3-pro": (2.00, 12.00),

    # DeepSeek
    "deepseek/deepseek-v4-flash": (0.11, 0.22),
    "deepseek/deepseek-v4-pro": (0.43, 0.87),
    "deepseek/deepseek-chat": (0.11, 0.22),
    "deepseek/deepseek-reasoner": (0.11, 0.22),
    "deepseek-v4-flash": (0.11, 0.22),
    "deepseek-v4-pro": (0.43, 0.87),
    "deepseek-chat": (0.11, 0.22),
    "deepseek-reasoner": (0.11, 0.22),

    # Kimi
    "kimi/kimi-k2.5": (0.60, 3.00),
    "kimi/kimi-k2.6": (0.95, 4.00),
    "kimi-k2.5": (0.60, 3.00),
    "kimi-k2.6": (0.95, 4.00),

    # GLM
    "glm/glm-4.5-flash": (0.0, 0.0),
    "glm/glm-4.7-flash": (0.0, 0.0),
    "glm/glm-4.6": (0.43, 1.74),
    "glm/glm-5": (1.00, 4.00),
    "glm/glm-5.1": (1.05, 3.50),
    "glm-4.5-flash": (0.0, 0.0),
    "glm-4.7-flash": (0.0, 0.0),
    "glm-4.6": (0.43, 1.74),
    "glm-5": (1.00, 4.00),
    "glm-5.1": (1.05, 3.50),

    # Qwen
    "qwen/qwen3.5-flash": (0.07, 0.26),
    "qwen/qwen3-coder-next": (0.11, 0.80),
    "qwen/qwen3.5-plus": (0.30, 1.80),
    "qwen/qwen3-max-thinking": (0.78, 3.90),
    "qwen/qwen3.7-max": (2.50, 7.50),
    "qwen3.5-flash": (0.07, 0.26),
    "qwen3-coder-next": (0.11, 0.80),
    "qwen3.5-plus": (0.30, 1.80),
    "qwen3-max-thinking": (0.78, 3.90),
    "qwen3.7-max": (2.50, 7.50),

    # Mistral
    "mistral/mistral-nemo": (0.02, 0.03),
    "mistral/ministral-8b": (0.05, 0.05),
    "mistral/mistral-small-3.1": (0.20, 0.60),
    "mistral/mistral-small-4": (0.20, 0.60),
    "mistral/codestral": (0.30, 0.90),
    "mistral/mistral-medium-3": (0.40, 2.00),
    "mistral/magistral-medium": (0.40, 2.00),
    "mistral/mistral-large-3": (2.00, 6.00),
    "mistral-nemo": (0.02, 0.03),
    "ministral-8b": (0.05, 0.05),
    "mistral-small-3.1": (0.20, 0.60),
    "mistral-small-4": (0.20, 0.60),
    "codestral": (0.30, 0.90),
    "mistral-medium-3": (0.40, 2.00),
    "magistral-medium": (0.40, 2.00),
    "mistral-large-3": (2.00, 6.00),

    # Llama
    "llama/llama-3.1-8b-instant": (0.05, 0.05),
    "llama/llama-3.3-70b": (0.15, 0.60),
    "llama/llama-4-scout": (0.05, 0.05),
    "llama/llama-4-maverick": (0.15, 0.60),
    "llama/llama-3.1-405b": (1.00, 3.00),
    "llama-3.1-8b-instant": (0.05, 0.05),
    "llama-3.3-70b": (0.15, 0.60),
    "llama-4-scout": (0.05, 0.05),
    "llama-4-maverick": (0.15, 0.60),
    "llama-3.1-405b": (1.00, 3.00),

    # xAI
    "xai/grok-4.1-fast": (0.20, 0.50),
    "xai/grok-4.3": (1.25, 2.50),
    "xai/grok-4.20": (2.00, 6.00),
    "grok-4.1-fast": (0.20, 0.50),
    "grok-4.3": (1.25, 2.50),
    "grok-4.20": (2.00, 6.00),

    # Cohere
    "cohere/command-r7b": (0.0375, 0.15),
    "cohere/command-r": (0.15, 0.60),
    "cohere/command-r-plus": (2.50, 10.00),
    "command-r7b": (0.0375, 0.15),
    "command-r": (0.15, 0.60),
    "command-r-plus": (2.50, 10.00),

    # DeepInfra
    "deepinfra/deepseek-ai/DeepSeek-V4-Flash": (0.10, 0.20),
    "deepinfra/deepseek-ai/DeepSeek-V3.2": (0.26, 0.38),
    "deepinfra/deepseek-ai/DeepSeek-V4-Pro": (1.30, 2.60),
    "deepinfra/deepseek-ai/DeepSeek-V3.1-Terminus": (0.27, 0.95),
    "deepinfra/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": (0.02, 0.03),
    "deepinfra/meta-llama/Llama-3.3-70B-Instruct-Turbo": (0.10, 0.32),
    "deepinfra/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8": (0.15, 0.60),
    "deepinfra/Qwen/Qwen3.5-35B-A3B": (0.14, 1.00),
    "deepinfra/Qwen/Qwen3.6-35B-A3B": (0.15, 0.95),
    "deepinfra/Qwen/Qwen3-Max": (1.20, 6.00),
    "deepinfra/moonshotai/Kimi-K2.5": (0.45, 2.25),
    "deepinfra/zai-org/GLM-5.1": (1.05, 3.50),
    "deepinfra/nvidia/Nemotron-3-Nano-30B-A3B": (0.05, 0.20),
    "deepinfra/MiniMaxAI/MiniMax-M2.7": (0.30, 1.20),
}

for model, (cin, cout) in CUSTOM_MODEL_PRICES.items():
    provider = model.split("/")[0] if "/" in model else "custom"
    litellm.model_cost[model] = {
        "max_tokens": 8192,
        "input_cost_per_token": cin / 1e6,
        "output_cost_per_token": cout / 1e6,
        "litellm_provider": provider,
        "mode": "chat"
    }

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


def completion_for_user(user, messages: List[Dict[str, str]], modality: str = "text", **kwargs: Any):
    """Call `litellm.completion` using the given user's saved settings for the specified modality.

    `user` must be a `repz.models.users` instance with `ai_integrations` and `ai_providers`.
    Defaults to 'text' modality. If user does not have a setup for this modality, falls back
    to the legacy direct user-level columns (ai_provider, ai_model, ai_api_key, etc.)
    for backward compatibility.

    Any extra kwargs are forwarded to `litellm.completion` as-is, so
    callers can pass `temperature`, `max_tokens`, `stream`, etc.
    """
    # Imported lazily so the rest of the app keeps working even if
    # litellm hasn't been installed yet (e.g. dev environments that
    # haven't pip-installed the new requirement).
    import litellm

    # Try to find the integration for the given modality
    integration = None
    if hasattr(user, "ai_integrations"):
        integration = next((i for i in user.ai_integrations if i.modality == modality), None)

    if integration and integration.provider_relation:
        api_key = integration.provider_relation.api_key
        provider = integration.provider_relation.provider
        api_base = integration.provider_relation.api_base
        model = integration.model
    else:
        # Fall back to legacy user-level columns
        api_key = getattr(user, "ai_api_key", None)
        provider = getattr(user, "ai_provider", None)
        api_base = getattr(user, "ai_api_base", None)
        model = getattr(user, "ai_model", None)

    if not api_key:
        raise AIConfigError(
            f"No API key configured for '{modality}' modality. Set one on your profile page."
        )

    model_id = _build_model_id(provider, model)

    call_kwargs: Dict[str, Any] = {
        "model": model_id,
        "messages": messages,
        "api_key": api_key,
    }
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


    # logger.debug(f"Provider: {provider}, Choices count: {len(choices) if choices else 0}")

    price_map = {}
    for value, _ in choices:
        if value:
            price = price_label(value, provider)
            # Store with original key
            price_map[value] = price
            # Also store with lowercase key for easier lookup
            price_map[value.lower()] = price
            logger.debug(f"Mapped {value} and {value.lower()} -> {price}")

    # logger.debug(f"Final price_map has {len(price_map)} entries")
    return price_map

"""Direct OpenAI-compatible calls for the application's two AI providers."""

from dataclasses import dataclass
from typing import Any

from openai import DefaultHttpxClient, OpenAI
from openai.types.chat import ChatCompletion, ChatCompletionMessageParam
from pydantic import BaseModel

PROVIDER_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "deepinfra": "https://api.deepinfra.com/v1/openai",
}


class AIConfigError(RuntimeError):
    """The user's AI configuration cannot be used safely."""


def provider_base_url(provider: str | None, api_base: str | None = None) -> str:
    base_url = PROVIDER_BASE_URLS.get(provider)
    if base_url is None:
        raise AIConfigError("Choose OpenAI or DeepInfra as your AI provider.")
    if api_base and api_base.rstrip("/") != base_url:
        raise AIConfigError(
            "Custom AI API URLs are not supported. Use the provider's default endpoint."
        )
    return base_url


@dataclass(frozen=True)
class UserAIConfig:
    api_key: str | None
    provider: str | None
    api_base: str | None
    model: str | None

    @property
    def is_usable(self) -> bool:
        try:
            provider_base_url(self.provider, self.api_base)
        except AIConfigError:
            return False
        return bool(self.api_key and self.model)


def resolve_user_ai_config(user, modality: str = "text") -> UserAIConfig:
    integration = next(
        (
            i
            for i in (getattr(user, "ai_integrations", None) or [])
            if i.modality == modality
        ),
        None,
    )
    if not integration or not integration.provider_relation:
        return UserAIConfig(None, None, None, None)
    provider = integration.provider_relation
    # Also reject previously saved cross-user links, not only new writes.
    if provider.user_id != user.id:
        return UserAIConfig(None, None, None, None)
    return UserAIConfig(
        provider.api_key, provider.provider, provider.api_base, integration.model
    )


def client_for_config(config: UserAIConfig) -> OpenAI:
    base_url = provider_base_url(config.provider, config.api_base)
    if not config.api_key:
        raise AIConfigError("No AI API key configured. Set one on your profile page.")
    return OpenAI(
        api_key=config.api_key,
        base_url=base_url,
        timeout=120.0,
        max_retries=2,
        http_client=DefaultHttpxClient(follow_redirects=False),
    )


def completion_for_user(
    user,
    messages: list[ChatCompletionMessageParam],
    modality: str = "text",
    *,
    temperature: float | None = None,
    response_format: type[BaseModel] | None = None,
) -> ChatCompletion:
    config = resolve_user_ai_config(user, modality)
    if not config.model:
        raise AIConfigError(f"No AI model configured for '{modality}'.")
    # Strip only our routing prefix; DeepInfra model names contain vendor slashes.
    model = config.model.removeprefix(f"{config.provider}/")
    params: dict[str, Any] = {"model": model, "messages": messages}
    # OpenAI reasoning models use their default sampling settings.
    if temperature is not None and not (
        config.provider == "openai"
        and model.startswith(("gpt-5", "gpt-6", "o1", "o3", "o4"))
    ):
        params["temperature"] = temperature
    with client_for_config(config) as client:
        if response_format is not None:
            return client.chat.completions.parse(
                **params, response_format=response_format
            )
        return client.chat.completions.create(**params)

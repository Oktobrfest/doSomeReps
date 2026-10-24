"""Exercise the real SDK over a fake HTTP transport; no paid API requests."""

import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

import httpx
import pytest
from flask import Flask
from openai import APIStatusError

from repz.ai import client, integration
from repz.ai.pricing import price_label
from repz.ai.qgen_service import ExtendedAnswer, _parse_extended_answer


def configured_user(
    provider="deepinfra",
    model="deepseek-ai/DeepSeek-V4.1-Flash",
    modality="text",
    api_base=None,
):
    credentials = SimpleNamespace(
        id=1,
        user_id=7,
        provider=provider,
        api_key="test-key",
        api_base=api_base,
    )
    return SimpleNamespace(
        id=7,
        ai_providers=[credentials],
        ai_integrations=[
            SimpleNamespace(
                modality=modality, provider_relation=credentials, model=model
            ),
        ],
    )


@pytest.fixture
def transport(monkeypatch):
    requests = []
    response = {"content": "Hello", "status": 200, "headers": {}}

    def handle(request):
        requests.append(request)
        body = (
            {"text": "Transcribed"}
            if request.url.path.endswith("transcriptions")
            else {
                "id": "test",
                "object": "chat.completion",
                "created": 0,
                "model": "echoed-model",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {
                            "role": "assistant",
                            "content": response["content"],
                        },
                    }
                ],
            }
        )
        return httpx.Response(
            response["status"], json=body, headers=response["headers"]
        )

    real_client = client.DefaultHttpxClient
    monkeypatch.setattr(
        client,
        "DefaultHttpxClient",
        lambda **kwargs: real_client(
            transport=httpx.MockTransport(handle),
            **kwargs,
        ),
    )
    return requests, response


@pytest.mark.parametrize(
    "base",
    [
        None,
        "https://api.deepinfra.com/v1/openai",
        "https://api.deepinfra.com/v1/openai/",
    ],
)
def test_production_deepinfra_configuration_and_vision(transport, base):
    requests, _ = transport
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Explain"},
                {
                    "type": "image_url",
                    "image_url": {"url": "https://example.org/image.png"},
                },
            ],
        }
    ]
    result = client.completion_for_user(
        configured_user(api_base=base), messages, temperature=0.4
    )
    assert result.choices[0].message.content == "Hello"
    request = requests[0]
    assert str(request.url) == "https://api.deepinfra.com/v1/openai/chat/completions"
    assert request.headers["authorization"] == "Bearer test-key"
    assert json.loads(request.content) == {
        "model": "deepseek-ai/DeepSeek-V4.1-Flash",
        "messages": messages,
        "temperature": 0.4,
    }


@pytest.mark.parametrize(
    "provider,model,expected",
    [
        ("openai", "openai/gpt-5-nano", "gpt-5-nano"),
        (
            "deepinfra",
            "deepinfra/deepseek-ai/DeepSeek-V4.1-Flash",
            "deepseek-ai/DeepSeek-V4.1-Flash",
        ),
    ],
)
def test_only_routing_prefix_is_removed(transport, provider, model, expected):
    requests, _ = transport
    client.completion_for_user(configured_user(provider, model), [], temperature=0.4)
    payload = json.loads(requests[0].content)
    assert payload["model"] == expected
    assert ("temperature" in payload) == (provider == "deepinfra")


@pytest.mark.parametrize("provider", ["openai", "deepinfra"])
def test_structured_response_uses_sdk_schema_and_existing_parser(transport, provider):
    requests, response = transport
    response["content"] = json.dumps(
        {
            "question": "Q",
            "answer": "A",
            "hint": None,
            "message_to_editor": None,
        }
    )
    result = client.completion_for_user(
        configured_user(provider), [], response_format=ExtendedAnswer
    )
    schema = json.loads(requests[0].content)["response_format"]
    assert schema["type"] == "json_schema"
    assert schema["json_schema"]["strict"] is True
    assert schema["json_schema"]["schema"]["additionalProperties"] is False
    assert _parse_extended_answer(result).answer == "A"


@pytest.mark.parametrize(
    "provider,model,base",
    [
        ("openai", "gpt-4o-mini-transcribe", "https://api.openai.com/v1"),
        ("deepinfra", "openai/whisper-large-v3", "https://api.deepinfra.com/v1/openai"),
    ],
)
def test_transcription_keeps_provider_native_model(transport, provider, model, base):
    requests, _ = transport
    user = configured_user(provider, model, "stt", base)
    config = client.resolve_user_ai_config(user, "stt")
    with client.client_for_config(config) as sdk:
        result = sdk.audio.transcriptions.create(
            model=config.model, file=("test.webm", b"audio")
        )
    assert result.text == "Transcribed"
    assert str(requests[0].url) == base + "/audio/transcriptions"
    assert model.encode() in requests[0].content
    assert sdk.is_closed()


@pytest.mark.parametrize(
    "base",
    [
        "http://127.0.0.1",
        "http://169.254.169.254",
        "https://api.deepinfra.com.evil.example/v1/openai",
        "https://api.deepinfra.com/v1/openai?redirect=evil",
        "https://api.openai.com/v1",
    ],
)
def test_untrusted_endpoints_fail_before_http(transport, base):
    requests, _ = transport
    with pytest.raises(client.AIConfigError):
        client.completion_for_user(configured_user(api_base=base), [])
    assert requests == []


def test_redirect_is_not_followed(transport):
    requests, response = transport
    response.update(status=307, headers={"location": "http://127.0.0.1/private"})
    with pytest.raises(APIStatusError):
        client.completion_for_user(configured_user(), [])
    assert len(requests) == 1


def test_environment_cannot_override_endpoint(transport, monkeypatch):
    requests, _ = transport
    monkeypatch.setenv("OPENAI_BASE_URL", "http://127.0.0.1/private")
    client.completion_for_user(configured_user("openai", "gpt-4o-mini"), [])
    assert requests[0].url.host == "api.openai.com"


def test_foreign_provider_cannot_be_saved():
    app = Flask(__name__)
    db = Mock()
    with app.test_request_context(
        method="POST", json={"modality": "text", "provider_id": 2}
    ):
        with patch.object(integration, "current_user", configured_user()), patch.object(
            integration, "session", db
        ):
            _, status = integration.save_ai_integration.__wrapped__()
    assert status == 404
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_unknown_model_price_is_not_reported_as_free():
    assert price_label("unknown", "deepinfra") == ""
    assert price_label("gpt-5-nano", "openai") == price_label(
        "openai/gpt-5-nano", "openai"
    )

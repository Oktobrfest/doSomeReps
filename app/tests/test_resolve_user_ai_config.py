import unittest
import sys
import os

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from repz.ai.litellm_client import resolve_user_ai_config


class FakeProvider:
    def __init__(self, api_key, provider, api_base=None):
        self.api_key = api_key
        self.provider = provider
        self.api_base = api_base


class FakeIntegration:
    def __init__(self, modality, provider_relation, model):
        self.modality = modality
        self.provider_relation = provider_relation
        self.model = model


class FakeUser:
    """Stands in for a `users` row and its per-modality AI integrations."""

    def __init__(self, integrations=()):
        self.ai_integrations = list(integrations)


class TestResolveUserAIConfig(unittest.TestCase):
    def test_uses_the_matching_modality_integration(self):
        user = FakeUser([
            FakeIntegration("text", FakeProvider("sk-1", "openai", "https://x"), "gpt-5-nano")
        ])
        config = resolve_user_ai_config(user, "text")

        self.assertEqual(config.api_key, "sk-1")
        self.assertEqual(config.provider, "openai")
        self.assertEqual(config.api_base, "https://x")
        self.assertEqual(config.model, "gpt-5-nano")
        self.assertTrue(config.is_usable)

    def test_each_modality_resolves_independently(self):
        user = FakeUser([
            FakeIntegration("text", FakeProvider("sk-text", "openai"), "gpt-5-nano"),
            FakeIntegration("stt", FakeProvider("sk-stt", "groq"), "whisper-large"),
        ])

        self.assertEqual(resolve_user_ai_config(user, "text").api_key, "sk-text")
        self.assertEqual(resolve_user_ai_config(user, "stt").model, "whisper-large")

    def test_other_modalities_do_not_satisfy_text(self):
        user = FakeUser([
            FakeIntegration("tts", FakeProvider("sk-tts", "openai"), "tts-1")
        ])
        config = resolve_user_ai_config(user, "text")

        self.assertIsNone(config.api_key)
        self.assertFalse(config.is_usable)

    def test_unconfigured_user_is_not_usable(self):
        self.assertFalse(resolve_user_ai_config(FakeUser(), "text").is_usable)

    def test_integration_without_a_provider_is_not_usable(self):
        """provider_id is ON DELETE SET NULL, so this really happens."""
        user = FakeUser([FakeIntegration("text", None, "gpt-5-nano")])
        config = resolve_user_ai_config(user, "text")

        self.assertIsNone(config.api_key)
        self.assertFalse(config.is_usable)

    def test_key_without_model_is_not_usable(self):
        user = FakeUser([FakeIntegration("text", FakeProvider("sk-1", "openai"), None)])

        self.assertFalse(resolve_user_ai_config(user, "text").is_usable)

    def test_model_without_provider_is_still_usable(self):
        """`_build_model_id` accepts a bare model, so a provider is optional."""
        user = FakeUser([
            FakeIntegration("text", FakeProvider("sk-1", None), "openai/gpt-4o-mini")
        ])

        self.assertTrue(resolve_user_ai_config(user, "text").is_usable)

    def test_user_without_integrations_attribute_is_not_usable(self):
        class Bare:
            pass

        self.assertFalse(resolve_user_ai_config(Bare(), "text").is_usable)

"""Forms for the user profile / AI integration page."""

from flask_wtf import FlaskForm
from wtforms import PasswordField, SelectField, StringField, SubmitField, SelectMultipleField, ValidationError
from wtforms.validators import Length, Optional


# A short, curated list of the most common LiteLLM provider ids so the
# user gets a helpful dropdown out of the box. The form also accepts a
# free-form "custom" provider id, so any of LiteLLM's 100+ supported
# providers can still be used.
#
# Provider id format follows the LiteLLM "<provider>/<model>" routing
# convention - see https://docs.litellm.ai/docs/providers
COMMON_PROVIDERS = [
    ("", "-- Select a provider --"),
    ("openai", "OpenAI"),
    ("anthropic", "Anthropic (Claude)"),
    ("gemini", "Google Gemini (AI Studio)"),
    ("vertex_ai", "Google Vertex AI"),
    ("azure", "Azure OpenAI"),
    ("bedrock", "AWS Bedrock"),
    ("cohere", "Cohere"),
    ("mistral", "Mistral"),
    ("groq", "Groq"),
    ("openrouter", "OpenRouter"),
    ("ollama", "Ollama (self-hosted)"),
    ("custom", "Other / custom (enter provider id manually)"),
]


LANGUAGE_CODES = [
    "en_US",
    "en_GB",
    "es_ES",
    "es_MX",
    "fr_FR",
    "de_DE",
    "it_IT",
    "pt_BR",
    "pt_PT",
    "nl_NL",
    "ru_RU",
    "ja_JP",
    "ko_KR",
    "zh_CN",
    "zh_TW",
    "ar_SA",
    "hi_IN",
    "tr_TR",
    "pl_PL",
    "sv_SE",
]


class AIProfileForm(FlaskForm):
    """Per-user AI provider configuration, stored on the users row."""

    ai_provider = SelectField(
        "AI Provider",
        choices=COMMON_PROVIDERS,
        validators=[Optional()],
    )
    # Used only when ai_provider == "custom" - lets the user type any
    # LiteLLM-supported provider id (e.g. "deepseek", "together_ai").
    ai_provider_custom = StringField(
        "Custom provider id",
        validators=[Optional(), Length(max=60)],
    )
    ai_model = StringField(
        "Model name",
        validators=[Optional(), Length(max=120)],
    )
    ai_api_key = PasswordField(
        "API Key",
        validators=[Optional(), Length(max=500)],
    )
    ai_api_base = StringField(
        "API Base URL (optional)",
        validators=[Optional(), Length(max=400)],
    )
    languages = SelectMultipleField(
        "Preferred Languages",
        choices=[(code, code) for code in LANGUAGE_CODES],
        validators=[Optional()],
    )
    submit = SubmitField("Save")

    def validate_languages(self, field):
        if field.data:
            if len(field.data) > 3:
                raise ValidationError("You can select up to 3 languages only.")
            valid_choices = {choice[0] for choice in (self.languages.choices or [])}
            for lang in field.data:
                if lang not in valid_choices:
                    raise ValidationError(f"'{lang}' is not a valid language option.")

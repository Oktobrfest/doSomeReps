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
    ("deepinfra", "DeepInfra"),
    ("ollama", "Ollama (self-hosted)"),
    ("custom", "Other / custom (enter provider id manually)"),
]


# Common providers and default models to make configuration easier in the UI/Form.
PREDEFINED_OPTIONS = {
    "openai": [
        # cheap → flagship
        "gpt-5-nano",          # cheapest ($0.05/$0.40)
        "gpt-5.4-nano",        # very cheap ($0.20)
        "gpt-5.4-mini",        # cheap mid-tier ($0.75)
        "gpt-5.4",             # great ($2.50/$15)
        "gpt-5.5",             # flagship ($5/$30)
        # TTS
        "tts-1",               # fast/cheap TTS
        "tts-1-hd",            # higher quality TTS
        "gpt-4o-mini-tts",     # newest, steerable, ~$0.015/min
    ],
    "anthropic": [
        "claude-haiku-4-5",    # cheapest current ($1/$5)
        "claude-sonnet-4-6",   # best balance ($3/$15) — top for nuanced translation
        "claude-opus-4-7",     # flagship ($5/$25)
    ],
    "gemini": [
        # cheap → flagship
        "gemini-2.5-flash-lite",  # cheapest ($0.10/$0.40)
        "gemini-2.5-flash",       # cheap, strong translation ($0.30/$2.50)
        "gemini-2.5-pro",         # premium
        "gemini-3-pro",           # flagship ($2/$12)
        # TTS / native audio
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts",
        "gemini-live-2.5-flash-native-audio",  # best for live multilingual voice
    ],
    "deepseek": [
           "deepseek-v4-flash",    # cheapest ($0.11/$0.22)
           "deepseek-v4-pro",      # reasoning flagship ($0.43/$0.87 promo)
           "deepseek-chat",        # alias for v4-flash non-thinking
           "deepseek-reasoner",    # alias for v4-flash thinking
       ],
       "kimi": [
           "kimi-k2.5",            # cheaper ($0.60/$3.00)
           "kimi-k2.6",            # flagship multimodal ($0.95/$4.00)
       ],
       "glm": [
           "glm-4.5-flash",        # free
           "glm-4.7-flash",        # free
           "glm-4.6",              # MIT licensed, $0.43/$1.74
           "glm-5",                # generalist flagship
           "glm-5.1",              # agentic coding leader
       ],
       "qwen": [
           "qwen3.5-flash",        # cheapest ($0.07/$0.26)
           "qwen3-coder-next",     # cheap coder ($0.11/$0.80)
           "qwen3.5-plus",         # multimodal ($0.30/$1.80, 1M ctx)
           "qwen3-max-thinking",   # reasoning ($0.78/$3.90)
           "qwen3.7-max",          # new flagship ($2.50/$7.50)
       ],
       "mistral": [
           "mistral-nemo",         # cheapest ($0.02/$0.03)
           "ministral-8b",         # edge
           "mistral-small-3.1",    # ($0.20/$0.60)
           "mistral-small-4",      # newer small
           "codestral",            # code ($0.30/$0.90)
           "mistral-medium-3",     # ($0.40/$2.00)
           "magistral-medium",     # reasoning
           "mistral-large-3",      # flagship, cheap output ($2/$6)
       ],
       "llama": [
           # Note: pick via hosted provider — Groq/Together/DeepInfra/Fireworks
           "llama-3.1-8b-instant",     # cheapest & fastest on Groq
           "llama-3.3-70b",            # workhorse
           "llama-4-scout",            # newer, ultra-cheap on Groq
           "llama-4-maverick",         # bigger Llama 4
           "llama-3.1-405b",           # largest
       ],
       "xai": [
           "grok-4.1-fast",        # cheap + 2M ctx ($0.20/$0.50)
           "grok-4.3",             # newest flagship ($1.25/$2.50)
           "grok-4.20",            # premium ($2/$6)
       ],
       "cohere": [
           "command-r7b",          # ultra-cheap ($0.0375/$0.15)
           "command-r",            # mid-tier RAG
           "command-r-plus",       # flagship RAG ($2.50/$10)
       ],
       "deepinfra": [
           # DeepSeek family
           "deepseek-ai/DeepSeek-V4-Flash",       # cheapest DeepSeek ($0.10/$0.20)
           "deepseek-ai/DeepSeek-V3.2",           # efficient ($0.26/$0.38)
           "deepseek-ai/DeepSeek-V4-Pro",         # flagship reasoning ($1.30/$2.60)
           "deepseek-ai/DeepSeek-V3.1-Terminus",  # hybrid reasoning ($0.27/$0.95)
           # Meta Llama family
           "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",  # fast/cheap ($0.02/$0.03)
           "meta-llama/Llama-3.3-70B-Instruct-Turbo",      # workhorse ($0.10/$0.32)
           "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", # MoE ($0.15/$0.60)
           # Qwen family
           "Qwen/Qwen3.5-35B-A3B",     # efficient MoE ($0.14/$1.00)
           "Qwen/Qwen3.6-35B-A3B",     # latest MoE ($0.15/$0.95)
           "Qwen/Qwen3-Max",           # flagship ($1.20/$6.00)
           # Other top models
           "moonshotai/Kimi-K2.5",     # multimodal agent ($0.45/$2.25)
           "zai-org/GLM-5.1",          # agentic coding ($1.05/$3.50)
           "nvidia/Nemotron-3-Nano-30B-A3B",  # fast MoE ($0.05/$0.20)
           "MiniMaxAI/MiniMax-M2.7",   # complex agents ($0.30/$1.20)
       ],
}


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
    ai_model = SelectField(
        "Model name",
        choices=[],
        validators=[Optional()],
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

    def __init__(self, *args, **kwargs):
        provider = kwargs.pop("provider", None)
        current_model = kwargs.pop("current_model", None)
        super().__init__(*args, **kwargs)
        self.populate_model_choices(provider, current_model)

    def populate_model_choices(self, provider, current_model=None):
        """Dynamically populate self.ai_model choices based on provider and current_model."""
        provider = (provider or "").lower().strip()
        if provider in PREDEFINED_OPTIONS:
            models = list(PREDEFINED_OPTIONS[provider])
        else:
            # Fallback: combine popular ones from openai, anthropic, gemini
            models = []
            for p in ["openai", "anthropic", "gemini"]:
                models.extend(PREDEFINED_OPTIONS[p])

        # Always ensure current user's model is in choices so selection is preserved
        if current_model and current_model not in models:
            models.insert(0, current_model)

        self.ai_model.choices = [("", "-- Select a model --")] + [(m, m) for m in models]

    def validate_languages(self, field):
        if field.data:
            if len(field.data) > 3:
                raise ValidationError("You can select up to 3 languages only.")
            valid_choices = {choice[0] for choice in (self.languages.choices or [])}
            for lang in field.data:
                if lang not in valid_choices:
                    raise ValidationError(f"'{lang}' is not a valid language option.")

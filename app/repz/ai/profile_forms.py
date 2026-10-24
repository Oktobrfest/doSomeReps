"""Profile page form, plus the provider/model catalogue the AI integration
endpoints serve to the client."""

from flask_wtf import FlaskForm
from wtforms import SubmitField, SelectMultipleField, ValidationError
from wtforms.validators import Optional

# Common providers and default models to make configuration easier in the UI/Form.
PREDEFINED_OPTIONS = {
    "openai": [
        # cheap → flagship
        "gpt-5-nano",  # cheapest ($0.05/$0.40)
        "gpt-5.4-nano",  # very cheap ($0.20)
        "gpt-5.4-mini",  # cheap mid-tier ($0.75)
        "gpt-5.4",  # great ($2.50/$15)
        "gpt-5.5",  # flagship ($5/$30)
        # TTS
        "tts-1",  # fast/cheap TTS
        "tts-1-hd",  # higher quality TTS
        "gpt-4o-mini-tts",  # newest, steerable, ~$0.015/min
    ],
    "deepinfra": [
        # DeepSeek family
        "deepseek-ai/DeepSeek-V4.1-Flash",
        "deepseek-ai/DeepSeek-V4-Flash",  # cheapest DeepSeek ($0.10/$0.20)
        "deepseek-ai/DeepSeek-V3.2",  # efficient ($0.26/$0.38)
        "deepseek-ai/DeepSeek-V4-Pro",  # flagship reasoning ($1.30/$2.60)
        "deepseek-ai/DeepSeek-V3.1-Terminus",  # hybrid reasoning ($0.27/$0.95)
        # Meta Llama family
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",  # fast/cheap ($0.02/$0.03)
        "meta-llama/Llama-3.3-70B-Instruct-Turbo",  # workhorse ($0.10/$0.32)
        "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",  # MoE ($0.15/$0.60)
        # Qwen family
        "Qwen/Qwen3.5-35B-A3B",  # efficient MoE ($0.14/$1.00)
        "Qwen/Qwen3.6-35B-A3B",  # latest MoE ($0.15/$0.95)
        "Qwen/Qwen3-Max",  # flagship ($1.20/$6.00)
        # Other top models
        "moonshotai/Kimi-K2.5",  # multimodal agent ($0.45/$2.25)
        "zai-org/GLM-5.1",  # agentic coding ($1.05/$3.50)
        "nvidia/Nemotron-3-Nano-30B-A3B",  # fast MoE ($0.05/$0.20)
        "MiniMaxAI/MiniMax-M2.7",  # complex agents ($0.30/$1.20)
    ],
}


# Ceiling on `ProfileLanguagesForm.languages`. The profile page mirrors this so the
# picker stops the user before the round-trip; keep the two in step.
MAX_LANGUAGES = 3


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


class ProfileLanguagesForm(FlaskForm):
    """The profile page's language preferences. Provider credentials and model
    choices are owned by the AI integration endpoints, not by this form."""

    languages = SelectMultipleField(
        "Preferred Languages",
        choices=[(code, code) for code in LANGUAGE_CODES],
        validators=[Optional()],
    )
    submit = SubmitField("Save")

    def validate_languages(self, field):
        if field.data:
            if len(field.data) > MAX_LANGUAGES:
                raise ValidationError(
                    f"You can select up to {MAX_LANGUAGES} languages only."
                )
            valid_choices = {choice[0] for choice in (self.languages.choices or [])}
            for lang in field.data:
                if lang not in valid_choices:
                    raise ValidationError(f"'{lang}' is not a valid language option.")

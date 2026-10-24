"""Display prices in USD per million tokens; unknown models have no estimate."""

MODEL_PRICES = {
    "openai/gpt-5-nano": (0.05, 0.4),
    "openai/gpt-5.4-nano": (0.2, 0.2),
    "openai/gpt-5.4-mini": (0.75, 0.75),
    "openai/gpt-5.4": (2.5, 15.0),
    "openai/gpt-5.5": (5.0, 30.0),
    "deepinfra/deepseek-ai/DeepSeek-V4-Flash": (0.1, 0.2),
    "deepinfra/deepseek-ai/DeepSeek-V3.2": (0.26, 0.38),
    "deepinfra/deepseek-ai/DeepSeek-V4-Pro": (1.3, 2.6),
    "deepinfra/deepseek-ai/DeepSeek-V3.1-Terminus": (0.27, 0.95),
    "deepinfra/meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": (0.02, 0.03),
    "deepinfra/meta-llama/Llama-3.3-70B-Instruct-Turbo": (0.1, 0.32),
    "deepinfra/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8": (0.15, 0.6),
    "deepinfra/Qwen/Qwen3.5-35B-A3B": (0.14, 1.0),
    "deepinfra/Qwen/Qwen3.6-35B-A3B": (0.15, 0.95),
    "deepinfra/Qwen/Qwen3-Max": (1.2, 6.0),
    "deepinfra/moonshotai/Kimi-K2.5": (0.45, 2.25),
    "deepinfra/zai-org/GLM-5.1": (1.05, 3.5),
    "deepinfra/nvidia/Nemotron-3-Nano-30B-A3B": (0.05, 0.2),
    "deepinfra/MiniMaxAI/MiniMax-M2.7": (0.3, 1.2),
}


def price_label(model_name, provider=None):
    if not model_name or not provider:
        return ""
    model = model_name.strip().removeprefix(provider + "/")
    price = MODEL_PRICES.get(f"{provider}/{model}")
    if price is None:
        return ""
    return f"${price[0]:.2f} / ${price[1]:.2f} per 1M tokens"

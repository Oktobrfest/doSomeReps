ARG NODE_ENV=prod
ARG PYTHON_VERSION=3.14
ARG PYTHON_LIB_VERSION=3.14

FROM python:${PYTHON_VERSION}-slim-bookworm AS builder

ARG NODE_ENV
ARG PYTHON_VERSION
ARG PYTHON_LIB_VERSION

# centralize Python/pip/runtime defaults so every stage behaves the same.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    libgomp1 \
    libpq5 \
    libstdc++6 \
    nodejs \
    npm \
    postgresql-client \
    tini \
    unixodbc \
 && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install setuptools && \
    if [ "$(uname -m)" = "aarch64" ]; then \
    pip install --extra-index-url https://www.piwheels.org/simple -r requirements.txt; \
    else pip install -r requirements.txt; \
    fi

# Node.js dependencies and build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source files for Vite build
COPY frontend/ ./
RUN NODE_ENV=production npm run build

WORKDIR /app


# =====  Final production stage    =====
FROM python:${PYTHON_VERSION}-slim-bookworm AS base-runtime

ARG PYTHON_LIB_VERSION
# move this??
# WORKDIR /app

# Copy only runtime dependencies and built assets from builder
COPY --from=builder /usr/local/lib/python${PYTHON_LIB_VERSION}/site-packages/ /usr/local/lib/python${PYTHON_LIB_VERSION}/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Install only required runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    g++ \
    unixodbc-dev \
    gnupg \
    nodejs \
    npm \
    build-essential \
    libstdc++6 \
    ffmpeg \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install hatchet-sdk directly in the runtime stage. It is deliberately
# excluded from requirements.txt (builder stage) because its namespace-
# package layout does not survive the multi-stage COPY of site-packages.
# This may upgrade pydantic past litellm's pin; the patch bump is compatible.
RUN pip install --no-cache-dir "hatchet-sdk==1.33.12"


# ARG NODE_ENV=production

# RUN if [ "$NODE_ENV" = "prod" ]; then \
#       echo "Copying app/ into runtime for PROD" && cp -a /app /app; \
#     else \
#       echo "NOT copying app/ into runtime"; \
#     fi

# ENTRYPOINT ["/sbin/tini","--","/app/entrypoint.sh"]
# ENTRYPOINT ["/bin/sh","--","/app/entrypoint.sh"]



# ===== development =====
FROM base-runtime AS development

COPY app/entrypoint.sh /app/entrypoint.sh

ENV FLASK_ENV=development \
    FLASK_DEBUG=1


# ===== prod =====
FROM base-runtime AS prod

COPY app /app
COPY --from=builder /app/repz/static/vite_dist/ /app/repz/static/vite_dist/

RUN mkdir -p /app/piper_voices && \
    for voice in \
        en_US-lessac-medium \
        es_ES-sharvard-medium \
        es_MX-claude-high \
        ru_RU-irina-medium \
    ; do \
        python -m piper.download_voices "$voice" --data-dir /app/piper_voices && \
        test -s "/app/piper_voices/${voice}.onnx" && \
        test -s "/app/piper_voices/${voice}.onnx.json"; \
    done

# # Download Sherpa-ONNX KWS WASM assets and model files --- JUST PUT IN GIT INSTEAD!
# RUN mkdir -p /app/repz/static/models/kws && \
#     MODELS_URL="https://modelscope.cn/api/v1/models/pkufool/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01/repo?Revision=master&FilePath=" && \
#     WASM_URL="https://huggingface.co/spaces/yuiyide/sherpa-oon-kws/resolve/main/" && \
#     for file in \
#         bpe.model \
#         decoder-epoch-12-avg-2-chunk-16-left-64.onnx \
#         encoder-epoch-12-avg-2-chunk-16-left-64.onnx \
#         joiner-epoch-12-avg-2-chunk-16-left-64.onnx \
#         tokens.txt \
#     ; do \
#         curl -sSLo "/app/repz/static/models/kws/$file" "${MODELS_URL}${file}" && \
#         test -s "/app/repz/static/models/kws/$file"; \
#     done && \
#     for file in \
#         sherpa-onnx-kws.js \
#         sherpa-onnx-wasm-kws-main.js \
#         sherpa-onnx-wasm-kws-main.wasm \
#         sherpa-onnx-wasm-kws-main.data \
#     ; do \
#         curl -sSLo "/app/repz/static/models/kws/$file" "${WASM_URL}${file}" && \
#         test -s "/app/repz/static/models/kws/$file"; \
#     done


FROM ${NODE_ENV} AS final

WORKDIR /app

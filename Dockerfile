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
RUN npm run build

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
 && rm -rf /var/lib/apt/lists/*


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


FROM ${NODE_ENV} AS final

WORKDIR /app

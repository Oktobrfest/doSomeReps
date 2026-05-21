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
COPY app/package*.json app/webpack.config.js ./
ENV NODE_ENV=${NODE_ENV}
RUN echo "### NODE_ENV = ${NODE_ENV} ###"

RUN npm install

# Copy only necessary source files for build
COPY app/repz/static/js ./repz/static/js
RUN npm run build


# =====  Final production stage    =====
FROM python:${PYTHON_VERSION}-slim-bookworm AS base-runtime

ARG PYTHON_LIB_VERSION
# move this??
# WORKDIR /app

# Copy only runtime dependencies and built assets from builder
COPY --from=builder /usr/local/lib/python${PYTHON_LIB_VERSION}/site-packages/ /usr/local/lib/python${PYTHON_LIB_VERSION}/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/
# NOT SURE IF YOU WANT THIS:
# COPY --from=builder /app/repz/static/dist ./repz/static/dist

# Install only required runtime dependencies
# TODO: LOOK THRU THESE AND MAKE SURE THEIR ALL EVEN NEEDED!
# RUN apk --no-cache add \
#     postgresql-libs \
#     g++ \
#     unixodbc-dev \
#     gnupg \
#     nodejs \
#     npm \
#     build-base \
#     libstdc++
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    g++ \
    unixodbc-dev \
    gnupg \
    nodejs \
    npm \
    build-essential \
    libstdc++6 \
 && rm -rf /var/lib/apt/lists/*


# ARG NODE_ENV=production

# RUN if [ "$NODE_ENV" = "prod" ]; then \
#       echo "Copying app/ into runtime for PROD" && cp -a /app /app; \
#     else \
#       echo "NOT copying app/ into runtime"; \
#     fi

# ENTRYPOINT ["/sbin/tini","--","/app/entrypoint.sh"]
# ENTRYPOINT ["/bin/sh","--","/app/entrypoint.sh"]



# ===== DEV =====
FROM base-runtime AS development

COPY app/entrypoint.sh /app/entrypoint.sh

ENV FLASK_ENV=development \
    FLASK_DEBUG=1



FROM base-runtime AS prod

COPY app /app



FROM ${NODE_ENV} AS final

WORKDIR /app

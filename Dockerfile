FROM python:3.12-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk --no-cache add \
    g++ \
    unixodbc-dev \
    gnupg \
    nodejs \
    npm \
    build-base \
    postgresql-dev \
    git

# Python dependencies
COPY requirements.txt .
RUN pip install setuptools && \
    if [ "$(uname -m)" = "aarch64" ]; then \
    pip install --extra-index-url https://www.piwheels.org/simple -r requirements.txt; \
    else pip install -r requirements.txt; \
    fi

# Node.js dependencies and build
COPY app/package*.json app/webpack.config.js ./
ARG NODE_ENV=production
RUN npm install

# Copy only necessary source files for build
COPY app/repz/static/js ./repz/static/js
RUN npm run build

# Final production stage
FROM python:3.12-alpine

WORKDIR /app

# Copy only runtime dependencies and built assets from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/
COPY --from=builder /app/repz/static/dist ./repz/static/dist

COPY app /app

# Install only required runtime dependencies
RUN apk --no-cache add \
    postgresql-libs \
    g++ \
    unixodbc-dev \
    gnupg \
    nodejs \
    npm \
    build-base \
    libstdc++
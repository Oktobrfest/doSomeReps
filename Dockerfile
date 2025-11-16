ARG NODE_ENV=prod

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
    git \
    tini

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


# Final production stage
FROM python:3.12-alpine AS base-runtime

# move this??
# WORKDIR /app

# Copy only runtime dependencies and built assets from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/
# NOT SURE IF YOU WANT THIS:
# COPY --from=builder /app/repz/static/dist ./repz/static/dist

# Install only required runtime dependencies
# TODO: LOOK THRU THESE AND MAKE SURE THEIR ALL EVEN NEEDED!
RUN apk --no-cache add \
    postgresql-libs \
    g++ \
    unixodbc-dev \
    gnupg \
    nodejs \
    npm \
    build-base \
    libstdc++

# ARG NODE_ENV=production

# RUN if [ "$NODE_ENV" = "prod" ]; then \
#       echo "Copying app/ into runtime for PROD" && cp -a /app /app; \
#     else \
#       echo "NOT copying app/ into runtime"; \
#     fi

# ENTRYPOINT ["/sbin/tini","--","/app/entrypoint.sh"]
# ENTRYPOINT ["/bin/sh","--","/app/entrypoint.sh"]




FROM base-runtime AS dev

COPY app/entrypoint.sh /app/entrypoint.sh

ENV FLASK_ENV=development \
    FLASK_DEBUG=1



FROM base-runtime AS prod

COPY app /app
WORKDIR /app


FROM ${NODE_ENV} AS final

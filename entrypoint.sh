#!/bin/bash

if [ "$FLASK_ENV" = "development" ]; then
    echo "Development environment detected, installing debugpy..."
    pip install debugpy
fi

# Execute the CMD from the Dockerfile or docker-compose file
exec "$@"

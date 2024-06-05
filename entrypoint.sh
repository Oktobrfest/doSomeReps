#!/bin/bash

if [ "$FLASK_ENV" = "development" || "$FLASK_DEBUG" = "1" ]; then
    echo "Development environment detected, installing debugpy..."
    pip install debugpy
    if [ "$IDE" = "vscode" ]; then
        echo "VSCODE DEBUGGING:::::: Starting the application with: python -m debugpy --wait-for-client --listen 0.0.0.0:5552 -m flask run --host=0.0.0.0  --port=5551 --debugger"
        python -m debugpy --wait-for-client --listen 0.0.0.0:5552 -m flask run --host=0.0.0.0 --port=5551 --debugger
    fi
    if [ "$IDE" = "pycharm" ]; then
        echo "PYCHARM DEBUGGING::::::: NEEDS MORE TESTING!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! TRYING: nothing right now... next try flask run"
    fi

fi

# Execute the CMD from the Dockerfile or docker-compose file
exec "$@"
git

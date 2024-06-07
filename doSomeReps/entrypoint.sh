#!/bin/bash
echo "IDE IS: "
echo "$IDE"
if [ "$FLASK_ENV" = "development" ] || [ "$FLASK_DEBUG" = "1" ]; then
    echo "Development environment detected, installing debugpy..."
    pip install debugpy
    if [ "$IDE" = "vscode" ]; then
        echo "VSCODE DEBUGGING:::::: Starting the application with: python -m debugpy --wait-for-client --listen 0.0.0.0:5554 -m flask run --host=0.0.0.0 --port=5553 --debugger ;;; the debugger is 5554 and app port is 5553"

        python -m debugpy --wait-for-client --listen 0.0.0.0:5554 -m flask run --host=0.0.0.0 --port=5553 --debugger
    fi
    if [ "$IDE" = "pycharm" ]; then
        pip install pydevd-pycharm==242.10180.30
        echo "PYCHARM DEBUGGING::::::: NEEDS MORE TESTING!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! TRYING: nothing right now... next try flask run"
    fi
else
    echo "Starting the application without debugger..."
    flask run --host=0.0.0.0 --port=5000
fi

# Execute the CMD from the Dockerfile or docker-compose file
# exec "$@"

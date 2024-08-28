#!/bin/bash
echo "ENTRYPOINT SCRIPT STARTED..."

echo "pwd is: "
echo $(pwd)


if [ -z "$APP_PORT" ]; then  
    APP_PORT=5554      
fi
# better way to set defaults:
APP_PORT=${APP_PORT:-5554}
DEBUG_PORT=${DEBUG_PORT:-5558}


# try to get other .env file into here to consolidate some shit: source doSomeReps/.env

echo "IDE IS: ${IDE}"
if [ "$FLASK_ENV" = "development" ] || [ "$FLASK_DEBUG" = "1" ]; then
    echo "Development environment detected, installing debugpy..."
    pip install debugpy
    if [ "$IDE" = "vscode" ]; then
        echo "VSCODE DEBUGGING:::::: Starting the application with: python -m debugpy --wait-for-client --listen 0.0.0.0:${DEBUG_PORT} -m flask run --host=0.0.0.0 --port=${APP_PORT} --debugger ;;; the debugger is ${DEBUG_PORT}  and app port is ${APP_PORT} "
        # IF PROBLEMS WITH DEBUGGER SURFACE- GET RID OF "--debugger"
        python -m debugpy --wait-for-client --listen 0.0.0.0:${DEBUG_PORT} -m flask run --host=0.0.0.0 --port=${APP_PORT} --debugger
    fi
    if [ "$IDE" = "pycharm" ]; then
        pip install pydevd-pycharm==242.10180.30
        echo "PYCHARM DEBUGGING::::::: NEEDS MORE TESTING!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! TRYING: nothing right now... next try flask run"
    fi
else
    echo "Starting the application without debugger..."
    flask run --host=0.0.0.0 --port=${APP_PORT}
fi

# Execute the CMD from the Dockerfile or docker-compose file
# exec "$@"

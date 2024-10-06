#!/bin/bash
echo "ENTRYPOINT SCRIPT STARTED..."

echo "pwd is: "
echo $(pwd)

APP_PORT=${APP_PORT:-5554}
DEBUG_PORT=${DEBUG_PORT:-5558}

echo "Running Webpack build..."
npm run build

echo "IDE IS: ${IDE}"
if [ "$FLASK_ENV" = "development" ] || [ "$FLASK_DEBUG" = "1" ]; then

    # This is for dev apparently only for now:::: NOT WORKING, FAILS!
#    USER z

    echo "Development environment detected, installing debugpy..."
    pip install debugpy
    if [ "$IDE" = "vscode" ]; then
        echo "VSCODE DEBUGGING:::::: Starting the application with: python -m debugpy --wait-for-client --listen 0.0.0.0:${DEBUG_PORT} -m flask run --host=0.0.0.0 --port=${APP_PORT} --debugger ;;; the debugger is ${DEBUG_PORT}  and app port is ${APP_PORT} "
        # IF PROBLEMS WITH DEBUGGER SURFACE- GET RID OF "--debugger"
        python -m debugpy --wait-for-client --listen 0.0.0.0:${DEBUG_PORT} -m flask run --host=0.0.0.0 --port=${APP_PORT} --debugger --reload
        #  reloader will likely give problems too!!
    fi
    if [ "$IDE" = "pycharm" ]; then
        pip install pydevd-pycharm==242.10180.30
        echo "PYCHARM DEBUGGING:::::::"
        echo "Starting Flask like this: /n flask run --host=0.0.0.0
        --port=${APP_PORT} --no-reload"
        flask run --host=0.0.0.0 --port=${APP_PORT} --no-reload
    fi
    if [ "$IDE" = "vsdev" ]; then
     echo "STARTING DEVELOPMENT USING: ${IDE} ; EXCECUTED: flask run --host=0.0.0.0 --port=${APP_PORT} --debugger --reload"
     flask run --host=0.0.0.0 --port=${APP_PORT} --debugger --reload
    fi
else
    echo "Starting the application without debugger..."
    flask run --host=0.0.0.0 --port=${APP_PORT}
fi

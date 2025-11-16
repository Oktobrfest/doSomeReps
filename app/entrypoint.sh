#!/bin/bash
echo "ENTRYPOINT SCRIPT STARTED..."

echo "pwd is: "
echo $(pwd)

APP_PORT=${APP_PORT:-5554}

# FIRST SEE IF IT'S EVEN NEEDED!
# python -m pip install -v --no-cache-dir -r /app/requirementsTEMP.txt || exit 1


# more verbose + explicit exit reporting
# python -m pip install -v --no-cache-dir -r /app/requirementsTEMP.txt
# EC=$?
# echo "[entrypoint] pip exit code = $EC"
# if [ $EC -ne 0 ]; then
#   echo "[entrypoint] pip failed — dumping pip debug:" >&2
#   python -m pip debug || true
#   exit $EC
# fi



echo "IDE IS: ${IDE}"
if [ "$FLASK_ENV" = "development" ] || [ "$FLASK_DEBUG" = "1" ]; then
    DEBUG_PORT=${DEBUG_PORT:-5558}
    # This is for dev apparently only for now:::: NOT WORKING, FAILS!
#    USER z
    echo "Running Webpack build..."
    npm run build

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
    # flask run --host=0.0.0.0 --port=${APP_PORT}

    # gunicorn --workers 2 --threads 2 --bind 0.0.0.0:${APP_PORT} "app:create_app()"

    # Production Gunicorn configuration
    exec gunicorn \
    --workers 2 \  
    --threads 2 \
    --timeout 30 \
    --keep-alive 5 \
    --bind 0.0.0.0:${APP_PORT} \
    --worker-tmp-dir /dev/shm \ 
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    "wsgi:app"
    
    # "app:create_app()"

fi

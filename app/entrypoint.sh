#!/bin/bash
echo "ENTRYPOINT SCRIPT STARTED..."

echo "Initial pwd: $(pwd)"

set -e


APP_PORT=${APP_PORT:-5554}

# echo "Initial ls:"
# ls

# If we're not already in the /app directory that contains wsgi.py,
# try /app as a fallback.
if [ ! -f "wsgi.py" ]; then
  echo "wsgi.py not found in $(pwd). Checking /app..."
  if [ -f "/app/wsgi.py" ]; then
    echo "Found /app/wsgi.py, cd /app"
    cd /app
  else
    echo "ERROR: wsgi.py not found in $(pwd) or /app"
    echo "Contents of /app (if it exists):"
    ls -al /app || echo "/app not accessible"
    exit 1
  fi
fi

echo "Using app directory: $(pwd)"

echo "IDE IS: ${IDE}"
if [ "$FLASK_ENV" = "development" ] || [ "$FLASK_DEBUG" = "1" ]; then
    DEBUG_PORT=${DEBUG_PORT:-5558}
    # This is for dev apparently only for now:::: NOT WORKING, FAILS!
#    USER z
    echo "Running Webpack build..."
    npm run build

    echo "Development environment detected, installing debugpy..."
    # pip install debugpy
    # if [ "$IDE" = "vscode" ]; then
    #     echo "VSCODE DEBUGGING:::::: Starting the application with: python -m debugpy --wait-for-client --listen 0.0.0.0:${DEBUG_PORT} -m flask run --host=0.0.0.0 --port=${APP_PORT} --debugger ;;; the debugger is ${DEBUG_PORT}  and app port is ${APP_PORT} "
    #     # IF PROBLEMS WITH DEBUGGER SURFACE- GET RID OF "--debugger"
    #     python -m debugpy --wait-for-client --listen 0.0.0.0:${DEBUG_PORT} -m flask run --host=0.0.0.0 --port=${APP_PORT} --debugger --reload
    #     #  reloader will likely give problems too!!
    # fi
    # if [ "$IDE" = "pycharm" ]; then
    #     pip install pydevd-pycharm==242.10180.30
    #     echo "PYCHARM DEBUGGING:::::::"
    #     echo "Starting Flask like this: /n flask run --host=0.0.0.0
    #     --port=${APP_PORT} --no-reload"
    #     flask run --host=0.0.0.0 --port=${APP_PORT} --no-reload
    # fi
    # if [ "$IDE" = "vsdev" ]; then
    #  echo "STARTING DEVELOPMENT USING: ${IDE} ; EXCECUTED: flask run --host=0.0.0.0 --port=${APP_PORT} --debugger --reload"
    #  flask run --host=0.0.0.0 --port=${APP_PORT} --debugger --reload
    # fi

 exec gunicorn --workers 2 --threads 2 --keep-alive 5 \
    --bind 0.0.0.0:${APP_PORT} --worker-tmp-dir /dev/shm \
    --access-logfile - --error-logfile - --log-level info "wsgi:app"



else
#     # flask run --host=0.0.0.0 --port=${APP_PORT}

    echo "Starting the application using Gunicorn..."
    exec gunicorn --workers 2 --threads 2 --keep-alive 5 --bind 0.0.0.0:${APP_PORT} --worker-tmp-dir /dev/shm --access-logfile - --error-logfile - --log-level info "wsgi:app"

fi

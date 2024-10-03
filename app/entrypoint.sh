#!/bin/bash
echo "ENTRYPOINT SCRIPT STARTED..."

echo "pwd is: "
echo $(pwd)

if [ -d "node_modules" ]; then
    echo "Contents of node_modules before move:"
    ls node_modules
fi

#echo "Checking if node_modules/pdfjs-dist exists..."
#if [ -d "node_modules/pdfjs-dist" ]; then
#    echo "pdfjs-dist found, proceeding to move it..."
#
#    # Ensure the destination directory exists
#    # mkdir -p /app/repz/static/js/
#
#    # Move the directory
#    mv node_modules/pdfjs-dist /app/repz/static/js/
#
#    # Print the contents of the destination directory after the move
#    # echo "Contents of /app/repz/static/js/ after move:"
#    # ls /app/repz/static/js/
#
#    echo "Move operation completed."
#else
#    echo "Error: pdfjs-dist not found in node_modules."
#fi

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
        echo "PYCHARM DEBUGGING::::::: NOT tested!! TODO: THIS!"

#         ONLY WORKS UPON STARTUP JUST LIKE OTHER APP!
#        echo "Starting Flask like this: /n flask run --host=0.0.0.0
#        --port=${APP_PORT} --debugger --reload"
#        flask run --host=0.0.0.0 --port=${APP_PORT} --debugger --reload


        echo "Starting Flask like this: /n flask run --host=0.0.0.0
        --port=${APP_PORT}"
        flask run --host=0.0.0.0 --port=${APP_PORT} --no-reload


#        python -m pydevd_pycharm --port ${DEBUG_PORT} --client 0.0.0.0 --wait \
#    --file app/wsgi.py

    fi
    if [ "$IDE" = "vsdev" ]; then
     echo "STARTING DEVELOPMENT USING: ${IDE} ; EXCECUTED: flask run --host=0.0.0.0 --port=${APP_PORT} --debugger --reload"
     flask run --host=0.0.0.0 --port=${APP_PORT} --debugger --reload
    fi
else
    echo "Starting the application without debugger..."
    flask run --host=0.0.0.0 --port=${APP_PORT}
fi

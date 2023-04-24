
"""Application entry point."""
from repz import init_app 

app = init_app()

# activate_this = '/home/ubuntu/projects/venv/bin/activate_this.py'
# with open(activate_this) as f:
# 	exec(f.read(), dict(__file__=activate_this))

# import sys
# import logging

# logging.basicConfig(stream=sys.stderr)
# sys.path.insert(0,"/var/www/html/repz/")

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=12000, debug=True)

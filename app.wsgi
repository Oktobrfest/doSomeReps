import sys
import logging


logging.basicConfig(stream=sys.stderr)
sys.path.insert(0, '/home/ubuntu/projects')

activate_this= '/home/ubuntu/projects/venv/bin/activate_this.py'

with open(activate_this) as file_:
    exec(file_.read(), dict(__file__=activate_this))

from  wsgi import app as application
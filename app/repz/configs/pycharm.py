import pydevd_pycharm

from os import environ, path

from dotenv import load_dotenv

BASE_DIR = path.abspath(path.join(path.dirname(__file__), '..', '..'))

load_dotenv(path.join(BASE_DIR, "dev.env"), override=True)

DEBUG_PORT = environ.get("DEBUG_PORT")

DEBUG_PORT_INT = int(DEBUG_PORT)

print("EEEEEE DEBUG_PORT", DEBUG_PORT_INT)
print("type(DEBUG_PORT)", type(DEBUG_PORT_INT))

pydevd_pycharm.settrace('host.docker.internal', port=DEBUG_PORT_INT, stdoutToServer=True,
                        stderrToServer=True, suspend=False)

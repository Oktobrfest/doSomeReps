
import sys
import pydevd_pycharm

# not sure if this is needed.
sys.path.append("./debug/pydevd-pycharm.egg")

pydevd_pycharm.settrace('host.docker.internal', port=5556, stdoutToServer=True, stderrToServer=True)
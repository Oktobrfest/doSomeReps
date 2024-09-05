import pydevd_pycharm

pydevd_pycharm.settrace('host.docker.internal', port=5010, stdoutToServer=True,
                        stderrToServer=True, suspend=False)

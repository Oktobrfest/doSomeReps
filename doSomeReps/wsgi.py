
"""Application entry point."""
# import sys
print("wsgi just ran!")
# print(sys.executable)
# print(sys.version)

from repz import init_app 

app = init_app()
app.debug = True

# activate_this = '/home/ubuntu/projects/venv/bin/activate_this.py'
# with open(activate_this) as f:
# 	exec(f.read(), dict(__file__=activate_this))

# import sys
# import logging

# logging.basicConfig(stream=sys.stderr)
# sys.path.insert(0,"/var/www/html/repz/")

# Oriignal with AWS:
#     app.run(host="127.0.0.1", port=12000, debug=True, 

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True, use_reloader=False)
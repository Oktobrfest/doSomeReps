
"""Application entry point."""
# print(sys.executable)
# print(sys.version)

from repz import init_app 

app = init_app()
# redundant- delete this? app.debug = True

# import sys
# import logging

# logging.basicConfig(stream=sys.stderr)
# sys.path.insert(0,"/var/www/html/repz/")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80, use_reloader=True)
    
    
    # redundant- delete this? ,debug=True, in the above .run
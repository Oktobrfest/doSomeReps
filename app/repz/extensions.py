from flask_caching import Cache
from flask_session import Session
from flask_wtf.csrf import CSRFProtect

cache = Cache()
sess = Session()
csrf = CSRFProtect()

"""Route declaration."""
from flask import Blueprint, url_for, current_app

#auth left in auth.py

home = Blueprint('home', __name__,
    template_folder='home/templates',
    static_folder='home/' + current_app.config['HOME_STATIC_FOLDER']
)

quest_ajx = Blueprint("quest_ajx", __name__)

que_ajx = Blueprint("que_ajx", __name__)

catz = Blueprint(
    'catz', __name__,
    template_folder='catz/templates',
)

catz_static = Blueprint(
    'catz_static', __name__,
    static_folder='catz/static'
)

user_ajx = Blueprint("user_ajx", __name__)


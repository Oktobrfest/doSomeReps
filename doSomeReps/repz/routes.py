"""Route declaration."""
from flask import Blueprint, url_for

#  consider eliminating this and making the directories packages with __init__ files. Especially for auth!!
auth = Blueprint(
    'auth', __name__,
    template_folder='auth/templates',
    static_folder='auth/static'
)

home = Blueprint('home', __name__,
    template_folder='home/templates',
    static_folder='home/static'
)

quest_ajx = Blueprint("quest_ajx", __name__)

catz = Blueprint(
    'catz', __name__,
    template_folder='catz/templates',
)

catz_static = Blueprint(
    'catz_static', __name__,
    static_folder='catz/static'
)


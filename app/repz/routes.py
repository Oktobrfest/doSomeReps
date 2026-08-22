"""Route declaration."""
from flask import Blueprint

#auth left in auth.py

home = Blueprint('home', __name__,
    template_folder='home/templates',
)

quest_ajx = Blueprint("quest_ajx", __name__)

que_ajx = Blueprint("que_ajx", __name__)

catz = Blueprint(
    'catz', __name__,
    template_folder='catz/templates',
)

user_ajx = Blueprint("user_ajx", __name__)


ai = Blueprint("ai", __name__)

audio = Blueprint("audio", __name__, template_folder='audio/templates')

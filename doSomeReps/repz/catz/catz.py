from flask import (
    Blueprint,
    render_template,
    session as local_session,
)

from flask import send_from_directory


from ..database import session

from ..bluehelpers import *
from flask_login import current_user

catz = Blueprint(
    'catz', __name__,
    template_folder='templates',
)

catz_static = Blueprint(
    'catz_static', __name__,
    static_folder='static'
)


@catz.route('/topiclist', methods=['GET', 'POST'], endpoint='topiclist')
def topiclist():
    topics_list = cat_questions_count(100)
    topics = dict(topics_list)
   
    # Render the template and pass the categories to it
    
    return render_template('topiclist.html', 
                           user=current_user,
                           topics=topics,
                           )

@catz_static.route('/static/<path:filename>')
def custom_static(filename):
    return send_from_directory(catz_static.static_folder, filename)




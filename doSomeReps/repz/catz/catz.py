from flask import (
    render_template,
    send_from_directory
)

from ..bluehelpers import cat_questions_count
from flask_login import current_user
from repz.routes import catz, catz_static


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




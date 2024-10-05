from flask import (
    render_template,
    send_from_directory
)
from flask_login import current_user, login_required

from ..bluehelpers import cat_questions_count, get_categories_questions, get_all_categories
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



@catz.route("/topic/<selected_topic>", methods=["GET"], endpoint="topic_questions")
@login_required
def topic_questions(selected_topic):
    
    # TODO: PAGINATION
    topics_list = cat_questions_count(100)
    topics = dict(topics_list)
    
    # Fetch the list of all topics with their question counts
    # category_list = get_all_categories()

    # Fetch the questions for the selected topic
    questions = get_categories_questions(selected_topic)

    return render_template(
        "topic_questions.html",
        title=f"Questions for {selected_topic}",
        user=current_user,
        selected_topic=selected_topic,
        topics=topics,
        questions=questions
    )



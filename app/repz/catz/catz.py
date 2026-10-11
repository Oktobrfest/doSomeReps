from flask import (
    redirect,
    render_template,
    url_for
)
from flask_login import current_user

from ..bluehelpers import cat_questions_count, unslugify
from repz.routes import catz


@catz.route('/topiclist', methods=['GET', 'POST'], endpoint='topiclist')
def topiclist():
    # Sorting belongs to the table itself, which sorts client-side.
    topics = [
        {
            "name": topic,
            "questionCount": count,
            "url": url_for("home.quemore", topic=topic),
        }
        for topic, count in cat_questions_count(100)
    ]

    return render_template('topic_list.html',
                           user=current_user,
                           topics=topics
                           )


@catz.route("/topic/<selected_topic>", methods=["GET"], endpoint="topic_questions")
def topic_questions(selected_topic):
    """A topic's questions moved to Que More; a permanent redirect keeps old links and their ranking."""
    return redirect(url_for("home.quemore", topic=unslugify(selected_topic)), code=301)

from flask import (
    render_template,
    url_for
)
from flask_login import current_user

from ..bluehelpers import (cat_questions_count, get_categories_questions,
                           slugify, unslugify)
from repz.routes import catz


@catz.route('/topiclist', methods=['GET', 'POST'], endpoint='topiclist')
def topiclist():
    # Sorting belongs to the table itself, which sorts client-side.
    topics = [
        {
            "name": topic,
            "questionCount": count,
            "url": url_for("catz.topic_questions",
                           selected_topic=slugify(topic)),
        }
        for topic, count in cat_questions_count(100)
    ]

    return render_template('topic_list.html',
                           user=current_user,
                           topics=topics
                           )


@catz.route("/topic/<selected_topic>", methods=["GET"], endpoint="topic_questions")
def topic_questions(selected_topic):
    """Public, so search engines can index a topic's questions; queuing them needs a login."""

    # TODO: PAGINATION
    topic_name = unslugify(selected_topic)

    questions = get_categories_questions(topic_name)

    return render_template(
        "topic_questions.html",
        title=f"Questions for {topic_name}",
        user=current_user,
        topic_name=topic_name,
        questions=questions
    )

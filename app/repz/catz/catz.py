from flask import (
    render_template,
    send_from_directory,
    request
)
from flask_login import current_user, login_required

from ..bluehelpers import (cat_questions_count, get_categories_questions,
                           get_all_categories, get_rating, slugify, unslugify)
from repz.routes import catz, catz_static


@catz.route('/topiclist', methods=['GET', 'POST'], endpoint='topiclist')
def topiclist():
    topics_count = cat_questions_count(100)

    topics_list = [(slugify(topic), topic, count) for topic, count in
                        topics_count]

    # default sorting by 'topic'
    sort_column = request.args.get('sort', 'topic')
    # default direction 'asc'
    sort_direction = request.args.get('direction', 'asc')

    # Define a key function for sorting
    if sort_column == 'topic':
        sort_key = lambda x: x[0].lower()  # Sort by topic name, case-insensitive
    elif sort_column == 'count':
        sort_key = lambda x: x[1]  # Sort by question count
    else:
        sort_key = lambda x: x[0].lower()  # Fallback to topic name

    reverse = sort_direction == 'desc'

    # Sort the list based on the sort_column and sort_direction
    sorted_topics = sorted(topics_list, key=sort_key, reverse=reverse)

    # Render the template and pass the categories to it    
    return render_template('topic_list.html',
                           user=current_user,
                           topics=sorted_topics,
                           sort_column=sort_column,
                           sort_direction=sort_direction
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
    original_topic = unslugify(selected_topic)
    questions_objs = get_categories_questions(original_topic)

    questions = []
    for question_obj in questions_objs:
        q = {
            "question_text": question_obj.question_text,
            "answer": question_obj.answer,
            "id": question_obj.question_id,
            "categories": [c.category_name for c in question_obj.categories],
            "rating": get_rating(question_obj.question_id)
        }
        questions.append(q)

    return render_template(
        "topic_questions.html",
        title=f"Questions for {selected_topic}",
        user=current_user,
        selected_topic=selected_topic,
        topics=topics,
        questions=questions
    )



from sqlalchemy.orm import (
    Query,
    selectinload,
    joinedload,
    aliased,
    subqueryload,
    with_parent,
    contains_eager
   )
from sqlalchemy.sql import func, exists, distinct
from sqlalchemy.sql.expression import bindparam
from sqlalchemy import select, Interval, join, intersect, update, not_, except_, and_
from .database import Base, engine, session
from .models import category, question, q_pic, quizq, level, rating, users

import re

from flask import session as local_session

from datetime import datetime, timedelta

import matplotlib.pyplot as plt
import numpy as np
from io import BytesIO
import base64


def clean_for_html(unclean: str) -> str:
    unclean = re.sub(r"[^\w\s]", "", unclean)
    # Replace all runs of whitespace with a single dash
    clean = re.sub(r"\s+", "_", unclean)
    return clean.lower()

def new_q_lookup(UID, selected_categories, qty_to_que):
    # subquery = select(question).join(question.categories).where(category.category_name.in_(selected_categories)).join(quizq, question.question_id == quizq.question_id)
      
    # subq = session.execute(subquery.distinct()).all()
                                                
    
    # allocatted_question_ids = []
    # for s in subq:
    #     allocatted_question_ids.append(s.question.question_id)
        
    # new_q_query = select(question).where(not_(question.question_id.in_(allocatted_question_ids))).join(question.categories).where(category.category_name.in_(selected_categories)).limit(qty_to_que)

    # new_questions = session.execute(new_q_query)

    # question_ids = []
    # for new_question in new_questions:
    #     question_ids.append(new_question.question.question_id)
        
        
        
    
    qty_added = new_quizq(question_ids, UID)   
    
    return qty_added



def set_session(key, value):
    # Set a value in the session
    local_session[key] = value
    
def new_quizq(question_ids, UID):
    new_q_quiz_list = []
    for question_id in question_ids:
        new_quizq = quizq(
            user_id=UID,
            level_no=1,
        )
        new_quizq.question_id = question_id
        new_q_quiz_list.append(new_quizq)
   
    session.add_all(new_q_quiz_list)
    session.commit()
    qty_added = len(new_q_quiz_list)
    return qty_added
    
def get_session(key):
    # Get the value from the session
    value = local_session.get(key, 'Not set')
    return value

def get_all_categories():
    category_list = []
    result = session.execute(select(category))
    category_list.extend(cat.category_name for cat in result.scalars())
    return category_list
        
def score(question_id):
    ratings = session.execute(select(rating.rating).where(rating.question_id == question_id)).scalars().all()
    
    score = []
    for rate in ratings:
        score += rate
    
    if len(score) == 0:
        final_score = 0
    else:
        final_score = sum(score) / len(score)
    
    return final_score
        

def get_quizes(selected_cats, UID):
    quest_wCats_qry = (
            select(question, category, quizq, level.days_hence)
            .join(question.categories)
            .where(category.category_name.in_(selected_cats))
            .join(
                quizq,
                and_(
                    question.question_id == quizq.question_id,
                    quizq.user_id == UID,
                    quizq.answered_on.is_(None),
                ),
            )
            .join(level, quizq.level_no == level.level_no)
        )

    result = session.execute(quest_wCats_qry.distinct()).all()

#   result_list = []
    que_list = []
    now = datetime.now()
    for r in result:
        # see if it's due to be answered- (levels 2+)
        if r.quizq.level_no > 1:
            # find the quiz question that was answered before it and grab that datetime
            previous_level = r.quizq.level_no - 1
            previous_quizq = (
                select(quizq.answered_on)
                .where(quizq.user_id == UID)
                .where(quizq.question_id == r.quizq.question_id)
                .where(quizq.level_no == previous_level)
                .where(quizq.correct == True)
                .order_by(quizq.answered_on.desc())
            )
            previous_quizq_date = (
                session.execute(previous_quizq.distinct()).scalars().first()
            )
            answered_on = previous_quizq_date
            days_hence = r.days_hence
            due_date = answered_on + timedelta(days=days_hence)
            if now > due_date:
                addit = True
            else:
                addit = False
        else:
            addit = True  # if it's level #1
        if addit == True:
            catz = []  # duplicate, but prob doesn't add all the categories!
            categories = []
            for c in r.question.categories:
                catz.append(c.category_name)
                for qu in c.questions:
                    if qu.question_id == r.question.question_id:
                        for cc in qu.categories:
                            categories.append(cc.category_name)

            pics = {k: [] for k in ["answer_pics", "hint_image", "question_image"]}
            for img in r.question.pics:
                pics[img.pic_type].append(img.pic_string)

            creator = select(users.username).where(users.id == r.question.created_by)  

            creator_username = session.execute(creator).first()[0]  
            
            rating = score(r.question.question_id)
            
            q = {
                "quizq_id": r.quizq.quizq_id,
                "question_name": r.question.question_name,
                "question_text": r.question.question_text,
                "hint": r.question.hint,
                "answer": r.question.answer,
                "created_by_id": r.question.created_by,
                "created_by_username": creator_username,
                "rating": rating,
                "level_no": r.quizq.level_no,
                "categories": catz,
                "pics": pics,
            }

            que_list.append(q)
            
    return que_list        


def render_chart(x_arr, y_arr, x_label, y_label):
    # Create sample data
    x = np.array(x_arr)
    y = np.array(y_arr)
    

    
    # Create the bar chart
    fig, ax = plt.subplots()
    ax.bar(x, y)
    
         # Set the axis labels
    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)
    
    # Render the chart to a base64-encoded string
    buffer = BytesIO()
    fig.savefig(buffer, format='png')
    chart_image = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    return chart_image

def get_user(user_id):
    if not isinstance(user_id, int):
        try:
            user_id_int = int(float(user_id))
        except:
            user_id_int = 0
    else:
        user_id_int = user_id

    usr_qry = select(users).where(users.id == user_id_int)
    
    usr_obj = session.execute(usr_qry).first()
    
    user = usr_obj[0]
    return user

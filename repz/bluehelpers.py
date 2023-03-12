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
from .models import category, question, q_pic, quizq, level, rating

import re

from flask import session as local_session


def clean_for_html(unclean: str) -> str:
    unclean = re.sub(r"[^\w\s]", "", unclean)
    # Replace all runs of whitespace with a single dash
    clean = re.sub(r"\s+", "_", unclean)
    return clean.lower()

def new_q_lookup(UID, selected_categories, qty_to_que):
    subquery = select(question).join(question.categories).where(category.category_name.in_(selected_categories)).join(quizq, question.question_id == quizq.question_id)
      
    subq = session.execute(subquery.distinct()).all()
                                                
    
    allocatted_question_ids = []
    for s in subq:
        allocatted_question_ids.append(s.question.question_id)
        
    new_q_query = select(question).where(not_(question.question_id.in_(allocatted_question_ids))).join(question.categories).where(category.category_name.in_(selected_categories)).limit(qty_to_que)

    new_questions = session.execute(new_q_query)

    question_ids = []
    for new_question in new_questions:
        question_ids.append(new_question.question.question_id)
    
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
        



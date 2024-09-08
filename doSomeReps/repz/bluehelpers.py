from sqlalchemy import select, and_, text
from .database import session
from .models import category, question, q_pic, quizq, level, rating, users, question_categories
import re
import os

from werkzeug.utils import secure_filename

from flask import session as local_session, flash, current_app

from datetime import datetime, timedelta

import matplotlib.pyplot as plt
import numpy as np
from io import BytesIO
import base64
from .aws_s3 import delete_s3_object, upload_file_to_s3
from repz import cache
import time

from sqlalchemy.exc import OperationalError
import logging


def clean_for_html(unclean: str) -> str:
    unclean = re.sub(r"[^\w\s]", "", unclean)
    # Replace all runs of whitespace with a single dash
    clean = re.sub(r"\s+", "_", unclean)
    return clean.lower()


def remove_underscore(html_string: str) -> str:
    spaced_string = re.sub(r"_" ," ", html_string)
    return spaced_string


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


def get_all_db_categories():
    category_list = []
    result = session.execute(select(category))
    category_list.extend(cat.category_name for cat in result.scalars())
    return category_list


def get_all_categories():
    category_list = cache.get('category_list')
    if category_list is None:
        category_list = get_all_db_categories()
        cache.set('category_list', category_list, timeout=60*60*24*7) # 1 week
    
    return category_list   

        
def score(question_id):
    ratings = session.execute(select(rating.rating).where(rating.question_id == question_id)).scalars().all()
    
    score = 0.0
    count = 0
    for rate in ratings:
        score += rate
        count += 1
    
    if count == 0:
        final_score = 0
    else:
        final_score = score / count
    
    return final_score
        

def get_quizes(selected_cats, UID):
      # Start the timer (to time excecution speed for development)
    start_time = time.time()

    user = get_user(UID)

    excluded_question_ids = [q.question_id for q in user.excluded_questions]
   
    quest_wCats_qry = (
        select(question, text("STRING_AGG(category.category_name, ',')"), quizq, level.days_hence)   
        .join(question.categories)
        .join(
            quizq,
            and_(
                question.question_id == quizq.question_id,
                quizq.user_id == UID,
                quizq.answered_on.is_(None),
            ),
        )
        .join(level, quizq.level_no == level.level_no)
        .group_by(question, quizq, level.days_hence)
    )

        # update query to omit 'excluded questions'
    quest_wCats_qry = quest_wCats_qry.filter(~question.question_id.in_(excluded_question_ids))

    #Print the SQL query
    # print(str("============================================================================================================"))
    # print(str(quest_wCats_qry))

    result = session.execute(quest_wCats_qry.distinct()).all()

    que_list = []
    now = datetime.now()
    for r in result:
        question_cats = [c.category_name for c in r.question.categories]
        if not set(question_cats) & set(selected_cats):
            continue  # Skip the current iteration if there's no intersection
        
        last_ansered = None
        user_rate_qry = select(rating.rating).where(rating.question_id == r.question.question_id).where(rating.user_id == UID)
        user_rated = session.execute(user_rate_qry).scalars().first()
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
                last_ansered = answered_on
            else:
                addit = False
        else:
            addit = True  # if it's level #1
        if addit == True:
            pics = {k: [] for k in ["answer_pics", "hint_image", "question_image"]}
            for img in r.question.pics:
                pics[img.pic_type].append(img.pic_string)

            creator = select(users.username).where(users.id == r.question.created_by)  

            creator_username = session.execute(creator).first()[0]  
            
            rating_score = score(r.question.question_id)
            
            q = {
                "quizq_id": r.quizq.quizq_id,
                "question_text": r.question.question_text,
                "hint": r.question.hint,
                "answer": r.question.answer,
                "created_by_id": r.question.created_by,
                "created_by_username": creator_username,
                "rating": rating_score,
                "level_no": r.quizq.level_no,
                "categories": question_cats,
                "pics": pics,
                "last_ansered": last_ansered,
                "user_rated": user_rated
            }
            que_list.append(q)

    # Calculate the elapsed time of function excecution for Development ONLY
    elapsed_time = time.time() - start_time
    print("Total get Que List Run Time:", elapsed_time, "seconds")   

    return que_list        


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


def listify_sql(models):
    obj_list = list(models)
    return obj_list


#list of dicts of lists
def tally_que_catz(quizq_list):
    category_count = {}
    for q in quizq_list:
        for c in q['categories']:
            if c in category_count:
                category_count[c] += 1
            else:
                category_count[c] = 1
    return category_count


def tally_catz(questions_list):
    category_count = {}
    for q in questions_list:
        for c in q.categories: 
            cat = c.category_name
            if cat in category_count:
                category_count[cat] += 1
            else:
                category_count[cat] = 1       
    return category_count


def split_dict(dict):        
    x_arr = []
    y_arr = []
    for k,v in dict.items():
        x_arr.append(k)
        y_arr.append(v)
    return x_arr, y_arr


def unexclude(question_id, UID):
    user = get_user(UID)
    
    ques_qry = select(question).where(question.question_id == question_id)
    
    ques_obj = session.execute(ques_qry).first()[0]

    if ques_obj in user.excluded_questions:
        user.excluded_questions.remove(ques_obj)
        session.commit() 
        msg = { 'success': "Un-Excluded Question" }
    else:
        msg = { 'failure': "Question object not found in user's excluded questions" }
        print(msg)

    return msg


def exclude(exclusion_ids, UID):
    user = get_user(UID)

    ques_qry = session.query(question).filter(question.question_id.in_(exclusion_ids))
    exclude_obs = ques_qry.all()

    exclude_count = 0
    for exc in exclude_obs:
        exclude_count += 1
        user.excluded_questions.append(exc)
    session.commit()

    return exclude_count


def delete_pic(pic):
        file_key = os.path.basename(pic.pic_string)
        is_delete_success = delete_s3_object(file_key)
        if is_delete_success:
            session.delete(pic)
            # try:
            #     s3_client.head_object(Bucket=current_app.config['BUCKET'], Key=file_key)
            #     exists = True
            # except botocore.exceptions.ClientError as e:
            #     if e.response['Error']['Code'] == "404":
            #         exists = False
            #     else:
            #         raise
            # print(f"Object exists in bucket: {exists}")
            # resp = s3_client.list_objects_v2(Bucket=current_app.config['BUCKET'], Prefix=file_key)
            # if 'Contents' in resp:
            #     for obj in resp['Contents']:
            #         print(f"Object key: {obj['Key']}")
            # else:
            #     print("No objects found in bucket")
        else:
            flash('Failed to delete picture from S3 Bucket!', category="error")     


def allowed_file(filename):
    return (
        "." in filename
        and filename.split(".", 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']
    )
            

def save_pictures(question, request):
    pic_types = {"answer_pics", "hint_image", "question_image"}
    file_directory = current_app.config['UPLOADED_IMAGES_DEST']
    for pic_type in pic_types:
        if pic_type in request.files:
            pictures = request.files.getlist(pic_type)
            for pic in pictures:
                if pic and allowed_file(pic.filename):
                    picname = secure_filename(pic.filename)
                    full_filename = os.path.join(file_directory, picname)
                    pic.save(os.path.join(file_directory, picname))
                    file_name = file_directory + picname
                    Metadata = {
                        # "x-amz-meta-question": question.question_id,
                        "x-amz-meta-pic_type": pic_type,
                    }
                    ExtraArgs = {"Metadata": Metadata}
                    location_string = upload_file_to_s3(
                        file_name, ExtraArgs, object_name=picname
                    )
                    question.pics.append(
                        q_pic(pic_string=location_string, pic_type=pic_type)
                    )
    session.commit()                
    return question


  # get all questions that are public
def cat_questions_count(qty):
    session.expire_all()
    questions_qry = select(question).where(question.privacy==False)
    try:
        questions_sql_models = session.execute(questions_qry).scalars().all()
        questions_list = listify_sql(questions_sql_models)
        questions_dict = tally_catz(questions_list)
        # Limited 10 categories.
        sorted_ques_cat_count = sorted(questions_dict.items(), key = lambda x: x[1], reverse = True)
        return sorted_ques_cat_count[:qty]
    except OperationalError as e:
        current_app.logger.error('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA, DB Error:' + str(e))
        session.close()
        raise 
    

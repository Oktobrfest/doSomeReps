import datetime
import os

from flask import current_app, logging
from werkzeug.utils import secure_filename

from .form_validation import allowed_file, validate_filename
from ..models import q_pic, question


def gen_unique_filename(filename):
    base_name, extension = os.path.splitext(filename)
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d__T%H-%M-%S__MS%f')
    # STILL NEED TO ADD A RANDOM NUMBER IN CASE THEY USE MULTI-SAME NAMES IN SAME REQUEST!
    return f"{base_name}__{timestamp}{extension}"


def save_pictures(question, request) -> question:
    """Saves picture to UPLOADED_IMAGES_DEST & S3 Bucket! & adds that URL to q_pic model, but doesn't commit that final part. Need to commit it to save the pic to the question. """
    pic_types = {"answer_pics", "hint_image", "question_image"}
    file_directory = current_app.config['UPLOADED_IMAGES_DEST']
    for pic_type in pic_types:
        if pic_type in request.files:
            pictures = request.files.getlist(pic_type)
            for pic in pictures:
                if pic and allowed_file(pic.filename):
                    filename = secure_filename(pic.filename) 
                    val, err = validate_filename(filename)                   
                    if val == False:
                        logging.error(err) 
                        raise ValueError(err)
                        
                    picname = gen_unique_filename(filename)
                    file_path = os.path.join(file_directory, picname)
                    pic.save(os.path.join(file_directory, picname))
                    Metadata = {
                        # "x-amz-meta-question": question.question_id,
                        "x-amz-meta-pic_type": pic_type,
                    }
                    ExtraArgs = {"Metadata": Metadata}
                    location_string = current_app.s3.upload_file_to_s3(
                        file_name = file_path,
                        ExtraArgs = ExtraArgs, 
                        object_name = picname
                    )
                    question.pics.append(
                        q_pic(pic_string=location_string, pic_type=pic_type)
                    )
  
    # session.commit()  
    return question
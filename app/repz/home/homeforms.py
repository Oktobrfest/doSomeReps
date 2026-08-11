from flask_uploads import configure_uploads, IMAGES, UploadSet
from wtforms import FileField
from flask_wtf import FlaskForm
from flask import current_app as app

from .form_validation import wtforms_filename_validator


class QuestionForm(FlaskForm):
    question_image = FileField("question_image", validators=[wtforms_filename_validator])
    hint_image = FileField("hint_image", validators=[wtforms_filename_validator])


images = UploadSet("images", IMAGES)
configure_uploads(app, images)
    
    
    





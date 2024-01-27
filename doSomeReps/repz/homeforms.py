from flask_uploads import configure_uploads, IMAGES, UploadSet
from wtforms import FileField, StringField, validators, SubmitField, IntegerField
from flask_wtf import FlaskForm
from wtforms.validators import DataRequired, NumberRange
from flask import current_app as app

class questionForm(FlaskForm):
    question_image = FileField("question_image")
    hint_image = FileField("hint_image")

    # question2 = StringField(u'Question text', validators=[validators.input_required()])

images = UploadSet("images", IMAGES)
configure_uploads(app, images)


class QueAdditionForm(FlaskForm):
    qty_to_que = IntegerField("qty_to_que", default=10, validators=[DataRequired(), NumberRange(min=0, max=999999)])
    que_more_submit = SubmitField("que_more_submit")
    qty_to_que.data = 10


    
    
    
    





"""Form for the AI Question Generator page."""

from flask_wtf import FlaskForm
from wtforms import IntegerField, SubmitField, TextAreaField
from wtforms.validators import DataRequired, NumberRange


class AIQuestionGenForm(FlaskForm):
    """User-supplied inputs for generating questions via AI."""

    quiz_content = TextAreaField(
        "Quiz Content",
        validators=[DataRequired()],
    )
    qty_from = IntegerField(
        "From",
        default=5,
        validators=[DataRequired(), NumberRange(min=0, max=50)],
    )
    qty_to = IntegerField(
        "To",
        default=10,
        validators=[DataRequired(), NumberRange(min=0, max=50)],
    )
    submit = SubmitField("Get AI Questions!")

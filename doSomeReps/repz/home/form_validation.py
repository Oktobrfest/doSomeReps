import re
import os

from wtforms import ValidationError
from flask import current_app


def validate_filename(filename):
    """
    Validates the filename to ensure it's safe and follows the rules:
    - Must not start with a dot and have no other periods (e.g., '.jpg' is invalid).
    - Must have a valid extension.
    - Must not contain invalid characters.
    """
   
    if not filename:  # Check if filename is empty or None
        return True, None
    
    # Check if filename starts with a period and doesn't contain another period
    if filename.startswith('.') and filename.count('.') == 1:
        return False, "Filename cannot start with a period and have no extension."


    valid_characters = is_valid_characters(filename)
    if not valid_characters:
        return False, "Filename contains invalid characters."

    # Regular expression to allow only alphanumeric, underscores, hyphens, and periods
    # valid_characters = re.match(r'^[a-zA-Z0-9_.-]+$', filename)
    # if not valid_characters:
    #     return False, "Filename contains invalid characters."

    # Check for a valid extension
    if not os.path.splitext(filename)[1]:  # If there's no file extension
        return False, "Filename must have a valid extension."

    return True, None


def wtforms_filename_validator(form, field):    
    if not field.data:
        return
    
    filename = field.data.filename
    
    if filename.startswith('.') and filename.count('.') == 1:
        raise ValidationError("Filename cannot start with a period and have no extension.")
    
    if not is_valid_characters:        
    # if not re.match(r'^[a-zA-Z0-9_.-]+$', filename):
        raise ValidationError("Filename contains invalid characters.")
    
    if not os.path.splitext(filename)[1]:
        raise ValidationError("Filename must have a valid extension.")


def allowed_file(filename):
    return (
        "." in filename
        and filename.split(".", 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']
    )
    

def is_valid_characters(filename):
    return re.match(r'^[a-zA-Z0-9_. !@#$%^&()\-]+$', filename) is not None
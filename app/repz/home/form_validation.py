import re
import os

from flask import current_app


VALID_FILENAME_RE = re.compile(r'^[a-zA-Z0-9_. !@#$%^&()\-]+$')


def is_valid_characters(filename):
    return VALID_FILENAME_RE.match(filename) is not None


def validate_filename(filename):
    """
    Validates the filename to ensure it's safe and follows the rules:
    - Must not start with a dot and have no other periods (e.g., '.jpg' is invalid).
    - Must have a valid extension.
    - Must not contain invalid characters.

    Returns (ok, error_message).
    """
    if not filename:  # Check if filename is empty or None
        return True, None

    # Check if filename starts with a period and doesn't contain another period
    if filename.startswith('.') and filename.count('.') == 1:
        return False, "Filename cannot start with a period and have no extension."

    if not is_valid_characters(filename):
        return False, "Filename contains invalid characters."

    # Check for a valid extension
    if not os.path.splitext(filename)[1]:  # If there's no file extension
        return False, "Filename must have a valid extension."

    return True, None


def allowed_file(filename):
    return (
        "." in filename
        and filename.split(".", 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']
    )

from typing import cast
from flask import current_app
from .aws_s3 import S3

S3_KEY = "repz_s3"

def init_s3(app) -> None:
    app.extensions[S3_KEY] = S3(app)

def get_s3() -> S3:
    return cast(S3, current_app.extensions[S3_KEY])

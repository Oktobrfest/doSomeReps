import boto3
import botocore
from config import Config
import logging
from botocore.exceptions import ClientError
import os


# These are the allowed file types, edit this part to fit your needs
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'svg'}

s3_client = boto3.client(
   "s3",
   region_name='us-west-2', 
   aws_access_key_id=Config.ACCESS_KEY_ID,
   aws_secret_access_key=Config.SECRET_ACCESS_KEY
)

def upload_file_to_s3(file_name, bucket=Config.BUCKET, object_name=None):
    """Upload a file to an S3 bucket

    :param file_name: File to upload
    :param bucket: Bucket to upload to
    :param object_name: S3 object name. If not specified then file_name is used
    :return: True if file was uploaded, else False
    """

    if object_name is None:
        object_name = os.path.basename(file_name)
    
    try:
        response = s3_client.upload_file(file_name, bucket, object_name)
    except ClientError as e:
        logging.error(e)
        return False
    # return True

    return f"{Config.S3_LOCATION}{file_name}"
    # return f"{Config.S3_LOCATION}fungul"
    
def allowed_file(filename):
    return '.' in filename and \
        filename.split('.', 1)[1].lower() in ALLOWED_EXTENSIONS
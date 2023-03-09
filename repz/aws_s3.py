import boto3
import botocore
from config import Config
import logging
from botocore.exceptions import ClientError
import os

s3_client = boto3.client(
   "s3",
   region_name='us-west-2', 
   aws_access_key_id=Config.ACCESS_KEY_ID,
   aws_secret_access_key=Config.SECRET_ACCESS_KEY
)

def upload_file_to_s3(file_name, ExtraArgs, bucket=Config.BUCKET, object_name=None):
    """Upload a file to an S3 bucket

    :param file_name: File to upload
    :param bucket: Bucket to upload to
    :param object_name: S3 object name. If not specified then file_name is used
    :return: True if file was uploaded, else False
    """

    if object_name is None:
        object_name = os.path.basename(file_name)
    
    try:
        response = s3_client.upload_file(file_name, bucket, object_name, ExtraArgs)
    except ClientError as e:
        logging.error(e)
        return False
    # return True

    return f"{Config.S3_LOCATION}{object_name}"
    
def delete_s3_object(object_name):
    """Delete an object from an S3 bucket

    :param object_name: S3 object name
    :return: True if object was deleted, else False
    """

    try:
        response = s3_client.delete_object(Bucket=Config.BUCKET, Key=object_name)
    except ClientError as e:
        logging.error(e)
        return False
    return True
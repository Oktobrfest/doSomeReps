import boto3
import botocore
from config import Config
import logging
from botocore.exceptions import ClientError
import os


s3 = boto3.client(
   "s3",
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
    
    object_name = str(file_name)
    isastring = isinstance(file_name, str)
    
    # If S3 object_name was not specified, use file_name
    if object_name is None:
        object_name = os.path.basename(file_name)

    # Upload the file
    s3_client = boto3.client('s3')
    try:
        response = s3_client.upload_file(file_name, bucket, object_name)
    except ClientError as e:
        logging.error(e)
        return False
    return True


# (file, bucket_name=Config.BUCKET, acl="public-read"):
#     """Upload a file to an S3 bucket

#     :param file_name: File to upload
#     :param bucket: Bucket to upload to
#     :param object_name: S3 object name. If not specified then file_name is used
#     :return: True if file was uploaded, else False
#     """
    
#     # If S3 object_name was not specified, use file_name
#     object_name = str(file.filename)
#     if object_name is None:
#         object_name = os.path.basename(file)

#     # Upload the file
# #    / s3_client = boto3.client('s3')
#     try:
#         response = s3.upload_file(file, bucket_name, object_name)
#     except ClientError as e:
#         logging.error(e)
#         return False
#     return True
    # try:

    #     s3.upload_fileobj(
    #         file,
    #         bucket_name,
    #         'file.filename',
    #         ExtraArgs={
    #             "ACL": acl
    #             # "ContentType": file.content_type
    #         }
    #     )

    # except Exception as e:
    #     # This is a catch all exception, edit this part to fit your needs.
    #     print("Something Happened: ", e)
    #     return e


    # # return f"{Config.S3_LOCATION}{file.filename}"
    # return f"{Config.S3_LOCATION}fungul"
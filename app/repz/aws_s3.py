import logging
import os

import boto3
import botocore
from botocore.exceptions import ClientError

from flask import current_app

class S3:
    _instance = None

    def __new__(cls, app=None):
        """Using Singleton pattern."""
        # If no instance exists, create one
        if cls._instance is None:
            cls._instance = super(S3, cls).__new__(cls)
            cls._instance._initialize(app)
            
        return cls._instance
    
    def _initialize(self, app=None):
        """Initialize the S3 instance with configuration"""
        # Use passed app or current_app from Flask context
        app_to_use = app or current_app
        
        self.default_bucket = app_to_use.config['BUCKET']
        self.region_name = app_to_use.config.get('REGION_NAME', 'us-west-2')
        
        self.client = boto3.client(
            "s3",
            region_name=self.region_name,
            aws_access_key_id=app_to_use.config['ACCESS_KEY_ID'],
            aws_secret_access_key=app_to_use.config['SECRET_ACCESS_KEY']
        )
    
    
    def base_url(self, bucket = None):
        if bucket == None:
            bucket = self.default_bucket
        
        return f"http://{bucket}.s3.{self.region_name}.amazonaws.com/"


#  RE-DO THE ORDER OF THESE TO MATCH BOTO (move extraargs to end and name it properly)
    def upload_file_to_s3(self, file_name, ExtraArgs, bucket = None, object_name = None):
        """Upload a file to an S3 bucket
        
        :param file_name: File to upload
        :param ExtraArgs Metadata that can be set, etc. see docs.
        :param bucket The S3 bucket to place the file into. Defaults to .env set Bucket aka. default_bucket
        :param object_name: S3 object name. If not specified then file_name is used
        :return: True if file was uploaded, else False
        """
        
        if bucket == None:
            bucket = self.default_bucket

        if object_name is None:
            object_name = os.path.basename(file_name)
        
        try:
            response = self.client.upload_file(file_name, bucket, object_name, ExtraArgs)
        except ClientError as e:
            logging.error(f"Failed to upload {file_name} to {bucket}/{object_name}. Error: {e}")
            return False
        
###### Include region in this string???????? Works without it, but isn't ideal i imagine.
        # return f"{current_app.config['S3_LOCATION']}{object_name}"
    
        return f"{self.base_url(bucket)}{object_name}"
        
    def delete_s3_object(self, object_name, bucket = None):
        """Delete an object from an S3 bucket

        :param object_name: S3 object name
        :return: True if object was deleted, else False
        """

        if bucket == None:
            bucket = self.default_bucket
            
        try:
            response = self.client.delete_object(Bucket = bucket, Key = object_name)
        except ClientError as e:
            logging.error(e)
            return False
        return True
    
    
    def lookup_object(self, object_name, bucket = None):
        """Lookup an object in the S3 bucket to see if it exists"""

        if bucket == None:
            bucket = self.default_bucket            

        response = self.client.list_objects_v2(
            Bucket=bucket,
            Prefix=object_name,
        )

        try:            
            for obj in response.get('Contents', []):
                if obj['Key'] == object_name:
                    # return obj['Size']
                    return True            
        except ClientError as e:
            logging.error(e)
            raise
        
        return False               
    
    def get_object(self, object_name, bucket=None):
        """Retrieve an object from S3 bucket
        
        :param object_name: S3 object name
        :param bucket: The S3 bucket to retrieve from. Defaults to default_bucket
        :return: Tuple of (content_bytes, content_type) if successful, None if not found
        """
        if bucket is None:
            bucket = self.default_bucket
            
        try:
            response = self.client.get_object(Bucket=bucket, Key=object_name)
            content = response['Body'].read()
            content_type = response.get('ContentType', 'application/octet-stream')
            return content, content_type
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                logging.warning(f"Object {object_name} not found in bucket {bucket}")
                return None
            else:
                logging.error(f"Failed to retrieve {object_name} from {bucket}. Error: {e}")
                raise
    
    def generate_presigned_url(self, object_name, bucket=None, expiration=3600):
        """Generate a presigned URL to access S3 object
        
        :param object_name: S3 object name
        :param bucket: The S3 bucket. Defaults to default_bucket
        :param expiration: Time in seconds for the presigned URL to remain valid
        :return: Presigned URL as string, None if error
        """
        if bucket is None:
            bucket = self.default_bucket
            
        try:
            response = self.client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': object_name},
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            logging.error(f"Failed to generate presigned URL for {object_name}. Error: {e}")
            return None


                
                # UGLY WAY:
                            # try:
            #     s3_client.head_object(Bucket=current_app.config['BUCKET'], Key=file_key)
            #     exists = True
            # except botocore.exceptions.ClientError as e:
            #     if e.response['Error']['Code'] == "404":
            #         exists = False
            #     else:
            #         raise
            # print(f"Object exists in bucket: {exists}")
            # resp = s3_client.list_objects_v2(Bucket=current_app.config['BUCKET'], Prefix=file_key)
            # if 'Contents' in resp:
            #     for obj in resp['Contents']:
            #         print(f"Object key: {obj['Key']}")
            # else:
            #     print("No objects found in bucket")
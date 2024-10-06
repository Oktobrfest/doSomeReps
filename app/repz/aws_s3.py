import logging
import os

import boto3
import botocore
from botocore.exceptions import ClientError

from flask import current_app

class S3:
    _instance = None

    def __new__(cls, current_app=None):
        """Using Singleton pattern."""
        # If no instance exists, create one
        if cls._instance is None:
            cls._instance = super(S3, cls).__new__(cls)
            cls._instance.default_bucket = current_app.config['BUCKET']
            cls._instance.region_name = current_app.config.get('REGION_NAME', 'us-west-2')
            
            cls._instance.client = boto3.client(
                "s3",
                region_name=cls._instance.region_name,
                aws_access_key_id=current_app.config['ACCESS_KEY_ID'],
                aws_secret_access_key=current_app.config['SECRET_ACCESS_KEY']
            )
            
        return cls._instance
    
    
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
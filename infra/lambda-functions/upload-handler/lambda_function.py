import json
import boto3
import uuid
from datetime import datetime
# import pymysql
import os
import base64
from decimal import Decimal

# AWS clients
s3 = boto3.client('s3')
sns = boto3.client('sns')
dynamodb = boto3.resource('dynamodb')

def get_secret():

    secret_name = "data-processing-database-secret-dev"
    region_name = "us-east-2"

    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        # For a list of exceptions thrown, see
        # https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        raise e

    secret = get_secret_value_response['SecretString']

def lambda_handler(event, context):
    """
    Simplified upload handler that uses DynamoDB instead of RDS
    """
    try:
        print(f"Received event: {json.dumps(event, default=str)}")
        
        # Handle CORS preflight requests
        if event.get('httpMethod') == 'OPTIONS':
            return cors_response(200, {'message': 'CORS preflight'})
        
        # Handle status check requests
        if event.get('httpMethod') == 'GET':
            return handle_status_request(event)
        
        # Handle file upload
        if event.get('httpMethod') == 'POST':
            return handle_file_upload(event)
        
        return cors_response(405, {'error': 'Method not allowed'})
        
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        
        return cors_response(500, {
            'error': 'Internal server error',
            'message': 'An unexpected error occurred while processing your request'
        })

def handle_file_upload(event):
    """Handle document upload"""
    # Extract file information
    headers = event.get('headers', {})
    file_name = headers.get('X-File-Name') or headers.get('x-file-name') or f'document_{uuid.uuid4()}.pdf'
    content_type = headers.get('Content-Type', 'application/pdf')
    
    # Generate unique processing ID
    processing_id = str(uuid.uuid4())
    
    # Decode file content
    body = event.get('body', '')
    is_base64_encoded = event.get('isBase64Encoded', False)
    
    if is_base64_encoded:
        file_content = base64.b64decode(body)
    else:
        file_content = body.encode('utf-8') if isinstance(body, str) else body
    
    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    if len(file_content) > max_size:
        return cors_response(413, {
            'error': 'File too large. Maximum size is 10MB.',
            'max_size_bytes': max_size
        })
    
    # Upload to S3
    bucket_name = os.environ['DOCUMENT_BUCKET']
    s3_key = f"raw/{processing_id}/{file_name}"
    
    s3.put_object(
        Bucket=bucket_name,
        Key=s3_key,
        Body=file_content,
        ContentType=content_type,
        Metadata={
            'processing-id': processing_id,
            'original-filename': file_name,
            'upload-timestamp': datetime.utcnow().isoformat()
        }
    )
    
    print(f"File uploaded to S3: s3://{bucket_name}/{s3_key}")
    
    # Record in DynamoDB
    table_name = os.environ['DYNAMODB_TABLE']
    table = dynamodb.Table(table_name)
    
    table.put_item(
        Item={
            'processing_id': processing_id,
            'original_filename': file_name,
            's3_key': s3_key,
            'file_size': len(file_content),
            'content_type': content_type,
            'status': 'uploaded',
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
    )
    
    print(f"Database record created for processing_id: {processing_id}")
    
    # Trigger next stage via SNS (if topic is configured)
    if 'DOCUMENT_PROCESSING_TOPIC_ARN' in os.environ:
        topic_arn = os.environ['DOCUMENT_PROCESSING_TOPIC_ARN']
        message = {
            'processing_id': processing_id,
            's3_key': s3_key,
            'original_filename': file_name,
            'file_size': len(file_content),
            'stage': 'stage1',
            'timestamp': datetime.utcnow().isoformat()
        }
        
        sns.publish(
            TopicArn=topic_arn,
            Message=json.dumps(message, default=str),
            Subject=f'Document uploaded: {processing_id}'
        )
        
        print(f"SNS notification sent for processing_id: {processing_id}")
    
    return cors_response(200, {
        'processing_id': processing_id,
        'message': 'Document uploaded successfully',
        'file_name': file_name,
        'file_size': len(file_content),
        's3_location': f's3://{bucket_name}/{s3_key}',
        'status': 'uploaded'
    })

def handle_status_request(event):
    """Handle status check requests"""
    path_parameters = event.get('pathParameters', {})
    processing_id = path_parameters.get('processing_id')
    
    if not processing_id:
        return cors_response(400, {'error': 'Missing processing_id'})
    
    try:
        table_name = os.environ['DYNAMODB_TABLE']
        table = dynamodb.Table(table_name)
        
        response = table.get_item(
            Key={'processing_id': processing_id}
        )
        
        if 'Item' not in response:
            return cors_response(404, {'error': 'Processing job not found'})
        
        # Convert Decimal to float for JSON serialization
        item = response['Item']
        if 'file_size' in item and isinstance(item['file_size'], Decimal):
            item['file_size'] = float(item['file_size'])
        
        return cors_response(200, {
            'processing_id': processing_id,
            'status': item.get('status'),
            'created_at': item.get('created_at'),
            'updated_at': item.get('updated_at'),
            'file_name': item.get('original_filename'),
            'file_size': item.get('file_size')
        })
        
    except Exception as e:
        print(f"Error retrieving status: {str(e)}")
        return cors_response(500, {'error': 'Error retrieving status'})

def cors_response(status_code, body):
    """Return response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-File-Name,X-File-Size',
            'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body, default=str)
    }
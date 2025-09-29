import json
import boto3
import uuid
import os
import base64
from datetime import datetime

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

    Upload handler with proper SNS messaging for schematic processor
    """
    try:
        print("=== UPLOAD LAMBDA START ===")
        print(f"Event: {json.dumps(event, default=str)}")
        
        # Check environment variables
        print("=== ENVIRONMENT VARIABLES ===")
        for key, value in os.environ.items():
            if 'DOCUMENT' in key or 'DYNAMODB' in key or 'SNS' in key:
                print(f"{key}: {value}")
        
        # Handle CORS preflight requests
        if event.get('httpMethod') == 'OPTIONS':
            print("Handling OPTIONS request")
            return cors_response(200, {'message': 'CORS preflight'})
        
        # Handle GET requests (status check)
        if event.get('httpMethod') == 'GET':
            print("Handling GET request")
            return handle_status_request(event)
        
        # Handle POST requests (file upload)
        if event.get('httpMethod') == 'POST':
            print("Handling POST request - file upload")
            return handle_file_upload(event)
        
        print(f"Unhandled method: {event.get('httpMethod')}")
        return cors_response(405, {'error': 'Method not allowed'})
        
    except Exception as e:
        print(f"=== ERROR ===")
        print(f"Error: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        
        return cors_response(500, {
            'error': 'Internal server error',
            'message': str(e)
        })

def handle_file_upload(event):
    """Handle file upload with proper schematic processing trigger"""
    try:
        print("=== UPLOAD HANDLER START ===")
        
        # Extract file information
        headers = event.get('headers', {})
        print(f"Headers: {headers}")
        
        file_name = headers.get('X-File-Name') or headers.get('x-file-name') or f'document_{uuid.uuid4()}.kicad_sch'
        content_type = headers.get('Content-Type', 'application/octet-stream')
        
        print(f"File name: {file_name}")
        print(f"Content type: {content_type}")
        
        # Generate processing ID
        processing_id = str(uuid.uuid4())
        print(f"Processing ID: {processing_id}")
        
        # Decode file content
        body = event.get('body', '')
        is_base64_encoded = event.get('isBase64Encoded', False)
        print(f"Body length: {len(body)}, Base64 encoded: {is_base64_encoded}")
        
        if is_base64_encoded:
            file_content = base64.b64decode(body)
        else:
            file_content = body.encode('utf-8') if isinstance(body, str) else body
        
        print(f"File content length: {len(file_content)}")
        
        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        if len(file_content) > max_size:
            return cors_response(413, {
                'error': 'File too large. Maximum size is 10MB.',
                'max_size_bytes': max_size
            })
        
        # Validate file type for schematic processing
        if not (file_name.endswith('.kicad_sch') or content_type in ['application/octet-stream', 'text/plain']):
            print(f"Warning: File {file_name} may not be a KiCad schematic")
        
        # Upload to S3
        bucket_name = os.environ['DOCUMENT_BUCKET']
        s3_key = f"raw/{processing_id}/{file_name}"
        
        print(f"Uploading to S3: s3://{bucket_name}/{s3_key}")
        
        s3.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=file_content,
            ContentType=content_type,
            Metadata={
                'processing-id': processing_id,
                'original-filename': file_name,
                'upload-timestamp': datetime.utcnow().isoformat(),
                'file-type': 'kicad-schematic' if file_name.endswith('.kicad_sch') else 'unknown'
            }
        )
        
        print("S3 upload successful")
        
        # Record in DynamoDB
        table_name = os.environ['DYNAMODB_TABLE']
        table = dynamodb.Table(table_name)
        
        print("Recording in DynamoDB")
        
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
        
        print("DynamoDB record created")
        
        # Trigger schematic processing via SNS
        topic_arn = os.environ.get('DOCUMENT_PROCESSING_TOPIC_ARN')
        if topic_arn:
            print(f"Publishing to SNS topic: {topic_arn}")
            
            # Create message for schematic processor
            message = {
                'processing_id': processing_id,
                's3_key': s3_key,
                'original_filename': file_name,
                'file_size': len(file_content),
                'content_type': content_type,
                'stage': 'stage1',  # This is important for the SQS filter
                'timestamp': datetime.utcnow().isoformat()
            }
            
            sns.publish(
                TopicArn=topic_arn,
                Message=json.dumps(message, default=str),
                Subject=f'Schematic uploaded for processing: {processing_id}',
                MessageAttributes={
                    'processing_id': {
                        'DataType': 'String',
                        'StringValue': processing_id
                    },
                    'stage': {
                        'DataType': 'String',
                        'StringValue': 'stage1'  # This enables SQS filtering
                    },
                    'file_type': {
                        'DataType': 'String',
                        'StringValue': 'kicad-schematic' if file_name.endswith('.kicad_sch') else 'unknown'
                    }
                }
            )
            
            print("SNS message published successfully")
        else:
            print("No SNS topic configured")
        
        return cors_response(200, {
            'processing_id': processing_id,
            'message': 'Schematic uploaded successfully and processing started',
            'file_name': file_name,
            'file_size': len(file_content),
            's3_location': f's3://{bucket_name}/{s3_key}',
            'status': 'uploaded',
            'next_step': 'Schematic processing will begin automatically'
        })
        
    except Exception as e:
        print(f"Upload handler error: {str(e)}")
        import traceback
        print(f"Upload traceback: {traceback.format_exc()}")
        raise

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
        
        item = response['Item']
        
        # Convert Decimal to int/float for JSON serialization
        for key, value in item.items():
            if hasattr(value, '__class__') and value.__class__.__name__ == 'Decimal':
                item[key] = int(value) if value % 1 == 0 else float(value)
        
        return cors_response(200, {
            'processing_id': processing_id,
            'status': item.get('status'),
            'created_at': item.get('created_at'),
            'updated_at': item.get('updated_at'),
            'file_name': item.get('original_filename'),
            'file_size': item.get('file_size'),
            'stage1_output_key': item.get('stage1_output_key'),
            'component_count': item.get('component_count'),
            'net_count': item.get('net_count'),
            'error_message': item.get('error_message')
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
            'Access-Control-Allow-Headers': 'Content-Type,X-File-Name',
            'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body, default=str)
    }
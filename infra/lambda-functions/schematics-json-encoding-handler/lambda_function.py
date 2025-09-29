import json
import boto3
import os
import tempfile
import uuid
from datetime import datetime
from decimal import Decimal

# Import your schematic processing library
from schematic_ingest import parse_schematic_with_paths

# AWS clients
s3 = boto3.client('s3')
sns = boto3.client('sns')
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """
    Lambda function to process schematic files
    Triggered by SQS messages from the upload function
    """
    try:
        print("=== SCHEMATIC PROCESSOR START ===")
        print(f"Event: {json.dumps(event, default=str)}")
        
        # Process each SQS record
        for record in event['Records']:
            try:
                process_schematic_message(record)
            except Exception as e:
                print(f"Error processing record {record.get('messageId', 'unknown')}: {str(e)}")
                # Don't raise here to allow other records to process
                continue
        
        return {
            'statusCode': 200,
            'body': json.dumps('Processing complete')
        }
        
    except Exception as e:
        print(f"=== FATAL ERROR ===")
        print(f"Error: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise  # Re-raise to trigger DLQ

def process_schematic_message(record):
    """Process a single SQS message containing schematic processing request"""
    
    # Parse the message
    message_body = record['body']
    
    # Handle SNS message format (message wrapped in SNS envelope)
    if 'Message' in json.loads(message_body):
        sns_message = json.loads(message_body)
        actual_message = json.loads(sns_message['Message'])
    else:
        actual_message = json.loads(message_body)
    
    print(f"Processing message: {actual_message}")
    
    processing_id = actual_message['processing_id']
    s3_key = actual_message['s3_key']
    original_filename = actual_message['original_filename']
    
    print(f"Processing schematic: {processing_id}")
    
    # Update status to processing
    update_processing_status(processing_id, 'stage1_processing')
    
    try:
        # Download file from S3
        input_bucket = os.environ['DOCUMENT_BUCKET']
        output_bucket = os.environ['PROCESSED_DATA_BUCKET']
        
        print(f"Downloading from S3: s3://{input_bucket}/{s3_key}")
        
        # Create temporary files
        with tempfile.NamedTemporaryFile(suffix='.kicad_sch', delete=False) as input_temp:
            with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as output_temp:
                
                input_path = input_temp.name
                output_path = output_temp.name
                
                # Download the schematic file
                s3.download_file(input_bucket, s3_key, input_path)
                print(f"Downloaded to temporary file: {input_path}")
                
                # Process the schematic using your library
                print("Processing schematic with parse_schematic_with_paths...")
                result = parse_schematic_with_paths(
                    input_file=input_path,
                    output_file=output_path
                )
                
                print(f"Processing complete. Found {len(result.get('components', []))} components")
                print(f"Found {len(result.get('nets', []))} nets")
                
                # Upload results to processed data bucket
                output_key = f"stage1/{processing_id}/{original_filename}.json"
                
                print(f"Uploading results to: s3://{output_bucket}/{output_key}")
                
                s3.upload_file(
                    output_path, 
                    output_bucket, 
                    output_key,
                    ExtraArgs={
                        'ContentType': 'application/json',
                        'Metadata': {
                            'processing-id': processing_id,
                            'original-filename': original_filename,
                            'stage': 'stage1_complete',
                            'component-count': str(len(result.get('components', []))),
                            'net-count': str(len(result.get('nets', []))),
                            'processed-timestamp': datetime.utcnow().isoformat()
                        }
                    }
                )
                
                # Clean up temp files
                os.unlink(input_path)
                os.unlink(output_path)
                
                print("Temporary files cleaned up")
        
        # Update database with results
        update_processing_status(
            processing_id, 
            'stage1_complete',
            stage1_output_key=output_key,
            component_count=len(result.get('components', [])),
            net_count=len(result.get('nets', []))
        )
        
        # Trigger next stage (if configured)
        trigger_next_stage(processing_id, output_key, result)
        
        print(f"Successfully processed schematic: {processing_id}")
        
    except Exception as e:
        print(f"Error processing schematic {processing_id}: {str(e)}")
        import traceback
        print(f"Processing traceback: {traceback.format_exc()}")
        
        # Update status to failed
        update_processing_status(processing_id, 'stage1_failed', error_message=str(e))
        raise

def update_processing_status(processing_id, status, **kwargs):
    """Update processing job status in DynamoDB"""
    try:
        table_name = os.environ['DYNAMODB_TABLE']
        table = dynamodb.Table(table_name)
        
        # Build update expression
        update_expression = "SET #status = :status, updated_at = :updated_at"
        expression_attribute_names = {"#status": "status"}
        expression_attribute_values = {
            ":status": status,
            ":updated_at": datetime.utcnow().isoformat()
        }
        
        # Add optional fields
        if 'stage1_output_key' in kwargs:
            update_expression += ", stage1_output_key = :stage1_output_key"
            expression_attribute_values[":stage1_output_key"] = kwargs['stage1_output_key']
        
        if 'component_count' in kwargs:
            update_expression += ", component_count = :component_count"
            expression_attribute_values[":component_count"] = kwargs['component_count']
            
        if 'net_count' in kwargs:
            update_expression += ", net_count = :net_count"
            expression_attribute_values[":net_count"] = kwargs['net_count']
        
        if 'error_message' in kwargs:
            update_expression += ", error_message = :error_message"
            expression_attribute_values[":error_message"] = kwargs['error_message']
        
        table.update_item(
            Key={'processing_id': processing_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values
        )
        
        print(f"Updated status for {processing_id}: {status}")
        
    except Exception as e:
        print(f"Error updating status: {str(e)}")
        # Don't raise - status update failure shouldn't stop processing

def trigger_next_stage(processing_id, stage1_output_key, processing_results):
    """Trigger the next processing stage via SNS"""
    try:
        # Check if next stage topic is configured
        next_stage_topic = os.environ.get('STAGE2_PROCESSING_TOPIC_ARN')
        if not next_stage_topic:
            print("No Stage 2 topic configured - processing pipeline ends here")
            return
        
        message = {
            'processing_id': processing_id,
            'stage1_output_key': stage1_output_key,
            'stage': 'stage2',
            'component_count': len(processing_results.get('components', [])),
            'net_count': len(processing_results.get('nets', [])),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        sns.publish(
            TopicArn=next_stage_topic,
            Message=json.dumps(message, default=str),
            Subject=f'Stage 1 Complete: {processing_id}',
            MessageAttributes={
                'processing_id': {
                    'DataType': 'String',
                    'StringValue': processing_id
                },
                'stage': {
                    'DataType': 'String',
                    'StringValue': 'stage2'
                }
            }
        )
        
        print(f"Triggered Stage 2 for processing_id: {processing_id}")
        
    except Exception as e:
        print(f"Error triggering next stage: {str(e)}")
        # Don't raise - next stage failure shouldn't fail current stage
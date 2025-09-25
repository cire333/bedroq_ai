#!/usr/bin/env python3
"""
AWS Lambda function for extracting datasheet URLs from KiCad JSON files
Supports multiple trigger sources: S3, API Gateway, direct invocation
"""

import json
import boto3
import logging
import os
from typing import Dict, List, Any
from dataclasses import dataclass
from urllib.parse import urlparse
import base64

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

@dataclass
class DatasheetInfo:
    """Information about a component datasheet"""
    component_name: str
    component_reference: str
    component_value: str
    datasheet_url: str
    mpn: str = ""

class LambdaDatasheetExtractor:
    """Lambda-optimized datasheet extractor"""
    
    def __init__(self):
        self.sqs_client = boto3.client('sqs')
        self.s3_client = boto3.client('s3')
        self.queue_name = os.environ.get('SQS_QUEUE_NAME', 'datasheet-processing-queue')
        self.region = os.environ.get('AWS_REGION', 'us-east-1')
        
    def extract_datasheets_from_json(self, json_data: Dict) -> List[DatasheetInfo]:
        """Extract all datasheet URLs from KiCad JSON"""
        datasheets = []
        
        # Extract from library symbols
        library_datasheets = self._extract_from_library_symbols(json_data)
        datasheets.extend(library_datasheets)
        
        # Extract from components
        component_datasheets = self._extract_from_components(json_data)
        datasheets.extend(component_datasheets)
        
        # Remove duplicates based on URL
        unique_datasheets = self._deduplicate_datasheets(datasheets)
        
        logger.info(f"Extracted {len(unique_datasheets)} unique datasheets")
        return unique_datasheets
    
    def _extract_from_library_symbols(self, json_data: Dict) -> List[DatasheetInfo]:
        """Extract datasheets from library symbols section"""
        datasheets = []
        library_symbols = json_data.get('library_symbols', {})
        
        for symbol_id, symbol_data in library_symbols.items():
            properties = symbol_data.get('properties', {})
            datasheet_prop = properties.get('Datasheet', {})
            datasheet_url = datasheet_prop.get('value', '').strip()
            
            if datasheet_url and self._is_valid_url(datasheet_url):
                mpn = properties.get('MPN', {}).get('value', '')
                
                datasheet = DatasheetInfo(
                    component_name=symbol_id,
                    component_reference=symbol_id,
                    component_value=properties.get('Value', {}).get('value', ''),
                    datasheet_url=datasheet_url,
                    mpn=mpn
                )
                datasheets.append(datasheet)
                
        return datasheets
    
    def _extract_from_components(self, json_data: Dict) -> List[DatasheetInfo]:
        """Extract datasheets from components section"""
        datasheets = []
        components = json_data.get('components', {})
        
        for comp_ref, comp_data in components.items():
            properties = comp_data.get('properties', {})
            datasheet_prop = properties.get('Datasheet', {})
            datasheet_url = datasheet_prop.get('value', '').strip()
            
            if datasheet_url and self._is_valid_url(datasheet_url):
                mpn = properties.get('mpn', {}).get('value', '') or properties.get('MPN', {}).get('value', '')
                
                datasheet = DatasheetInfo(
                    component_name=comp_data.get('value', comp_ref),
                    component_reference=comp_ref,
                    component_value=comp_data.get('value', ''),
                    datasheet_url=datasheet_url,
                    mpn=mpn
                )
                datasheets.append(datasheet)
                
        return datasheets
    
    def _is_valid_url(self, url: str) -> bool:
        """Check if URL is valid"""
        if not url:
            return False
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False
    
    def _deduplicate_datasheets(self, datasheets: List[DatasheetInfo]) -> List[DatasheetInfo]:
        """Remove duplicate datasheets based on URL"""
        seen_urls = set()
        unique_datasheets = []
        
        for datasheet in datasheets:
            if datasheet.datasheet_url not in seen_urls:
                seen_urls.add(datasheet.datasheet_url)
                unique_datasheets.append(datasheet)
                
        return unique_datasheets
    
    def create_sqs_message(self, datasheets: List[DatasheetInfo], circuit_info: Dict = None, source_info: Dict = None) -> Dict:
        """Create SQS message payload"""
        message = {
            'circuit_info': circuit_info or {},
            'source_info': source_info or {},
            'datasheet_count': len(datasheets),
            'datasheets': []
        }
        
        for datasheet in datasheets:
            datasheet_entry = {
                'component_name': datasheet.component_name,
                'component_reference': datasheet.component_reference,
                'component_value': datasheet.component_value,
                'datasheet_url': datasheet.datasheet_url,
                'mpn': datasheet.mpn,
                'domain': urlparse(datasheet.datasheet_url).netloc
            }
            message['datasheets'].append(datasheet_entry)
        
        return message
    
    def send_to_sqs(self, message_data: Dict) -> bool:
        """Send datasheet information to SQS queue"""
        try:
            # Get queue URL
            response = self.sqs_client.get_queue_url(QueueName=self.queue_name)
            queue_url = response['QueueUrl']
            
            # Send message
            response = self.sqs_client.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps(message_data, indent=2),
                MessageAttributes={
                    'MessageType': {
                        'StringValue': 'datasheet_extraction',
                        'DataType': 'String'
                    },
                    'DatasheetCount': {
                        'StringValue': str(message_data['datasheet_count']),
                        'DataType': 'Number'
                    },
                    'CircuitName': {
                        'StringValue': message_data.get('circuit_info', {}).get('title', 'Unknown'),
                        'DataType': 'String'
                    }
                }
            )
            
            logger.info(f"Message sent to SQS. MessageId: {response['MessageId']}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send message to SQS: {str(e)}")
            return False
    
    def process_json_data(self, json_data: Dict, source_info: Dict = None) -> Dict:
        """Process KiCad JSON data and return results"""
        try:
            # Extract circuit metadata
            metadata = json_data.get('metadata', {})
            title_block = metadata.get('title_block', {})
            circuit_info = {
                'title': title_block.get('title', 'Unknown'),
                'company': title_block.get('company', 'Unknown'),
                'revision': title_block.get('rev', 'Unknown'),
                'date': title_block.get('date', 'Unknown')
            }
            
            # Extract datasheets
            datasheets = self.extract_datasheets_from_json(json_data)
            
            if not datasheets:
                logger.warning("No datasheets found in the JSON data")
                return {
                    'statusCode': 200,
                    'body': {
                        'success': True,
                        'message': 'No datasheets found',
                        'datasheet_count': 0
                    }
                }
            
            # Create and send SQS message
            message_data = self.create_sqs_message(datasheets, circuit_info, source_info)
            success = self.send_to_sqs(message_data)
            
            if success:
                logger.info(f"Successfully processed {len(datasheets)} datasheets from {circuit_info['title']}")
                return {
                    'statusCode': 200,
                    'body': {
                        'success': True,
                        'message': f'Processed {len(datasheets)} datasheets',
                        'datasheet_count': len(datasheets),
                        'circuit_info': circuit_info,
                        'datasheets': [ds.__dict__ for ds in datasheets]
                    }
                }
            else:
                return {
                    'statusCode': 500,
                    'body': {
                        'success': False,
                        'message': 'Failed to send message to SQS'
                    }
                }
                
        except Exception as e:
            logger.error(f"Error processing JSON data: {str(e)}")
            return {
                'statusCode': 500,
                'body': {
                    'success': False,
                    'message': f'Processing error: {str(e)}'
                }
            }

def lambda_handler(event, context):
    """
    AWS Lambda entry point
    Supports multiple event sources:
    1. S3 trigger (file upload)
    2. API Gateway (HTTP request)
    3. Direct invocation (test events)
    """
    
    extractor = LambdaDatasheetExtractor()
    
    try:
        # Determine event source and extract JSON data
        if 'Records' in event:
            # S3 trigger
            return handle_s3_event(event, extractor)
        elif 'httpMethod' in event:
            # API Gateway trigger
            return handle_api_gateway_event(event, extractor)
        else:
            # Direct invocation
            return handle_direct_invocation(event, extractor)
            
    except Exception as e:
        logger.error(f"Lambda handler error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'message': f'Lambda error: {str(e)}'
            })
        }

def handle_s3_event(event, extractor):
    """Handle S3 file upload trigger"""
    results = []
    
    for record in event['Records']:
        if record['eventSource'] == 'aws:s3':
            bucket = record['s3']['bucket']['name']
            key = record['s3']['object']['key']
            
            logger.info(f"Processing S3 object: s3://{bucket}/{key}")
            
            try:
                # Download file from S3
                response = extractor.s3_client.get_object(Bucket=bucket, Key=key)
                file_content = response['Body'].read().decode('utf-8')
                json_data = json.loads(file_content)
                
                # Process the file
                source_info = {
                    'source': 's3',
                    'bucket': bucket,
                    'key': key,
                    'event_time': record['eventTime']
                }
                
                result = extractor.process_json_data(json_data, source_info)
                results.append(result)
                
            except Exception as e:
                logger.error(f"Error processing S3 object {key}: {str(e)}")
                results.append({
                    'statusCode': 500,
                    'body': {
                        'success': False,
                        'message': f'Error processing {key}: {str(e)}'
                    }
                })
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'processed_files': len(results),
            'results': results
        })
    }

def handle_api_gateway_event(event, extractor):
    """Handle API Gateway HTTP request"""
    try:
        # Parse request body
        body = event.get('body', '')
        if event.get('isBase64Encoded', False):
            body = base64.b64decode(body).decode('utf-8')
        
        json_data = json.loads(body)
        
        # Process the data
        source_info = {
            'source': 'api_gateway',
            'method': event.get('httpMethod'),
            'path': event.get('path'),
            'source_ip': event.get('requestContext', {}).get('identity', {}).get('sourceIp')
        }
        
        result = extractor.process_json_data(json_data, source_info)
        
        return {
            'statusCode': result['statusCode'],
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result['body'])
        }
        
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': False,
                'message': 'Invalid JSON in request body'
            })
        }

def handle_direct_invocation(event, extractor):
    """Handle direct Lambda invocation"""
    if 'json_data' in event:
        # JSON data provided directly
        json_data = event['json_data']
        source_info = {
            'source': 'direct_invocation',
            'invocation_type': 'json_data'
        }
        
        result = extractor.process_json_data(json_data, source_info)
        return result
        
    elif 's3_bucket' in event and 's3_key' in event:
        # S3 location provided
        try:
            response = extractor.s3_client.get_object(
                Bucket=event['s3_bucket'], 
                Key=event['s3_key']
            )
            file_content = response['Body'].read().decode('utf-8')
            json_data = json.loads(file_content)
            
            source_info = {
                'source': 'direct_invocation',
                'invocation_type': 's3_reference',
                'bucket': event['s3_bucket'],
                'key': event['s3_key']
            }
            
            result = extractor.process_json_data(json_data, source_info)
            return result
            
        except Exception as e:
            return {
                'statusCode': 500,
                'body': {
                    'success': False,
                    'message': f'Error reading S3 file: {str(e)}'
                }
            }
    else:
        return {
            'statusCode': 400,
            'body': {
                'success': False,
                'message': 'Invalid event format. Provide json_data or s3_bucket/s3_key'
            }
        }
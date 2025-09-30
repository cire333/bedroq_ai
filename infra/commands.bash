# 1. Prerequisites

# Install AWS CLI and configure credentials
aws configure

# Install SAM CLI for Lambda deployment
pip install aws-sam-cli

# Create deployment bucket 
aws s3 mb s3://bedroq-schematics


# 2. Deploy Infrastructure

# Create CloudFormation stack
aws cloudformation create-stack \
  --stack-name document-processing-pipeline \
  --template-body file://Iac/infrastructure.yaml \
  --parameters ParameterKey=DBPassword,ParameterValue=YourSecurePassword \
  --capabilities CAPABILITY_IAM

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name document-processing-pipeline


# 3. Deploy Lambda Functions

# Package and deploy Lambda functions
sam build
sam deploy --guided

# Or use AWS CLI
for function in upload-handler stage1-processor stage2-processor final-processor; do
    zip -r ${function}.zip ${function}/
    aws lambda create-function \
        --function-name ${function} \
        --runtime python3.9 \
        --role arn:aws:iam::YOUR-ACCOUNT:role/lambda-execution-role \
        --handler lambda_function.lambda_handler \
        --zip-file fileb://${function}.zip
done

# 4. Configure Triggers
# Subscribe Lambda functions to SQS queues
aws lambda create-event-source-mapping \
    --event-source-arn arn:aws:sqs:REGION:ACCOUNT:stage1-processing \
    --function-name stage1-processor

aws lambda create-event-source-mapping \
    --event-source-arn arn:aws:sqs:REGION:ACCOUNT:stage2-processing \
    --function-name stage2-processor

# Subscribe SQS queues to SNS topics
aws sns subscribe \
    --topic-arn arn:aws:sns:REGION:ACCOUNT:document-processing \
    --protocol sqs \
    --notification-endpoint arn:aws:sqs:REGION:ACCOUNT:stage1-processing

# TODO

# Security Considerations

# Use VPC endpoints for S3 and SQS access
# Enable encryption at rest for S3 buckets and RDS
# Implement least privilege IAM roles
# Use AWS Secrets Manager for database credentials
# Enable CloudTrail for audit logging

# Cost Optimization

# Use S3 Intelligent Tiering for long-term storage
# Implement Lambda function optimization (memory, timeout)
# Consider Reserved Capacity for RDS if running continuously
# Use CloudWatch Logs retention policies

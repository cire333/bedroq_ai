aws configure set region us-east-2

### upload lambda test integration 


### deploy lambda 
sam build
sam deploy --stack-name "data-processing" --config-env dev --guided   //use guided for the initial run


aws lambda invoke --function-name upload-handler --invocation-type Event --cli-binary-format raw-in-base64-out --payload '{"key1": "value1"}' response.json


#### Lambda quick test
# 3. Test the deployment
# Get the API URL from the outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name data-processing \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text)  

# Test the API
curl "$API_URL/test"

# Upload a file (create a test PDF first)
echo "Test PDF content" > test.pdf
curl -X POST \
  -H "Content-Type: application/pdf" \
  -H "X-File-Name: test.pdf" \
  --data-binary @test.pdf \
  "$API_URL/upload"

### Misc Commands

#### Get logs
sam logs --stack-name data-processing --region us-east-2

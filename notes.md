### upload lambda test integration 

aws lambda invoke --function-name upload-handler --invocation-type Event --cli-binary-format raw-in-base64-out --payload '{"key1": "value1"}' response.json


sam deploy --stack-name "data-processing" --config-env dev



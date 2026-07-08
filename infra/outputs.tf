output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.content.domain_name
}

output "s3_bucket_name" {
  description = "S3 content bucket name"
  value       = aws_s3_bucket.content.id
}

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.cli.id
}

output "cognito_domain" {
  description = "Cognito Hosted UI domain (for PKCE browser login)"
  value       = "${aws_cognito_user_pool_domain.main.domain}.auth.us-east-1.amazoncognito.com"
}

output "dynamodb_users_table" {
  description = "DynamoDB users table name"
  value       = aws_dynamodb_table.users.name
}

output "dynamodb_lexicons_table" {
  description = "DynamoDB lexicons table name"
  value       = aws_dynamodb_table.lexicons.name
}

output "app_url" {
  description = "CloudFront domain for the OpenNext app (new Lambda-hosted stack)"
  value       = "https://${aws_cloudfront_distribution.app.domain_name}"
}

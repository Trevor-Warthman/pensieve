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

output "dynamodb_users_table" {
  description = "DynamoDB users table name"
  value       = aws_dynamodb_table.users.name
}

output "dynamodb_lexicons_table" {
  description = "DynamoDB lexicons table name"
  value       = aws_dynamodb_table.lexicons.name
}

output "ecr_repository_url" {
  description = "ECR repository URL for the app image"
  value       = aws_ecr_repository.app.repository_url
}

output "alb_dns_name" {
  description = "ALB DNS name — point your domain here"
  value       = aws_lb.app.dns_name
}

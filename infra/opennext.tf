# ── OpenNext server (Lambda + Function URL + CloudFront) ──────────────────────
# Additive only — the existing ECS/ALB stack (ecs.tf, ecr.tf) stays live until
# this is validated. See infra/opennext.tf rollout notes / second-brain chunks
# tagged #pensieve #opennext for the full migration plan.

# ── IAM ────────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "opennext_server" {
  name = "${local.name_prefix}-opennext-server"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "opennext_server_basic" {
  role       = aws_iam_role.opennext_server.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "opennext_server" {
  name = "${local.name_prefix}-opennext-server"
  role = aws_iam_role.opennext_server.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"]
        Resource = [
          aws_dynamodb_table.lexicons.arn,
          "${aws_dynamodb_table.lexicons.arn}/index/*",
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.users.arn}/index/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [aws_s3_bucket.content.arn, "${aws_s3_bucket.content.arn}/*"]
      }
    ]
  })
}

# ── Server function ────────────────────────────────────────────────────────────
# Placeholder zip until `open-next build` runs and the real server function
# (app/.open-next/server-functions/default) is zipped into this path.

resource "aws_lambda_function" "opennext_server" {
  function_name    = "${local.name_prefix}-opennext-server"
  role             = aws_iam_role.opennext_server.arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  memory_size      = 1024
  timeout          = 30
  filename         = "${path.module}/lambda-src/opennext-server.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-src/opennext-server.zip")

  environment {
    variables = {
      AWS_S3_BUCKET           = aws_s3_bucket.content.id
      DYNAMODB_LEXICONS_TABLE = aws_dynamodb_table.lexicons.name
      DYNAMODB_USERS_TABLE    = aws_dynamodb_table.users.name
      COGNITO_USER_POOL_ID    = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID       = aws_cognito_user_pool_client.cli.id
      # Same exposure level as the ECS task def (secrets{} block) — plain env
      # var, zero app code changes. Visible in Lambda console + tf state.
      JWT_SECRET                 = data.aws_secretsmanager_secret_version.jwt_secret.secret_string
      NEXT_PUBLIC_API_URL        = aws_apigatewayv2_stage.default.invoke_url
      NEXT_PUBLIC_CLOUDFRONT_URL = "https://${aws_cloudfront_distribution.content.domain_name}"
    }
  }
}

data "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id = aws_secretsmanager_secret.jwt_secret.id
}

resource "aws_lambda_function_url" "opennext_server" {
  function_name      = aws_lambda_function.opennext_server.function_name
  authorization_type = "AWS_IAM"
  invoke_mode        = "BUFFERED"
}

resource "aws_lambda_permission" "cloudfront_invoke_opennext" {
  statement_id  = "AllowCloudFrontInvokeFunctionUrl"
  action        = "lambda:InvokeFunctionUrl"
  function_name = aws_lambda_function.opennext_server.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.app.arn
}

# AWS added this as a second required permission (alongside InvokeFunctionUrl)
# for CloudFront OAC -> Lambda Function URL origins; without it CloudFront gets
# a 403 from the function URL before the handler ever runs.
resource "aws_lambda_permission" "cloudfront_invoke_opennext_function" {
  statement_id  = "AllowCloudFrontInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.opennext_server.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.app.arn
}

# ── Static assets bucket ───────────────────────────────────────────────────────
# Dedicated bucket, separate from aws_s3_bucket.content — different lifecycle,
# and reusing content would spuriously trigger its invalidate Lambda.

resource "aws_s3_bucket" "app_assets" {
  bucket = "${local.name_prefix}-app-assets-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "app_assets" {
  bucket                  = aws_s3_bucket.app_assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "app_assets" {
  name                              = "${local.name_prefix}-app-assets-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "app_assets" {
  bucket = aws_s3_bucket.app_assets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.app_assets.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.app.arn
        }
      }
    }]
  })
}

# ── Lambda Function URL origin access control ─────────────────────────────────

resource "aws_cloudfront_origin_access_control" "opennext_server" {
  name                              = "${local.name_prefix}-opennext-server-oac"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CachingDisabled equivalent, but with Authorization in the header allowlist —
# required for CloudFront's OAC-generated SigV4 signature to reach a Lambda
# Function URL origin (empty header list on the managed policy drops it).
resource "aws_cloudfront_cache_policy" "opennext_server" {
  name        = "${local.name_prefix}-opennext-server-cache"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 1

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization"]
      }
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# ── CloudFront distribution ────────────────────────────────────────────────────
# Separate from aws_cloudfront_distribution.content (existing content CDN).
# Default behavior -> Lambda Function URL (server, uncached).
# Static paths -> S3 assets bucket (cached).

resource "aws_cloudfront_distribution" "app" {
  enabled = true
  comment = "Pensieve ${local.name_prefix} app (OpenNext)"

  origin {
    domain_name              = replace(replace(aws_lambda_function_url.opennext_server.function_url, "https://", ""), "/", "")
    origin_id                = "opennext-server"
    origin_access_control_id = aws_cloudfront_origin_access_control.opennext_server.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  origin {
    domain_name              = aws_s3_bucket.app_assets.bucket_regional_domain_name
    origin_id                = "app-assets-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.app_assets.id
  }

  default_cache_behavior {
    target_origin_id       = "opennext-server"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = aws_cloudfront_cache_policy.opennext_server.id
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader managed policy
  }

  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "app-assets-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized managed policy
  }

  ordered_cache_behavior {
    path_pattern           = "/pagefind/*"
    target_origin_id       = "app-assets-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized managed policy
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "${local.name_prefix}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_resources" {
  name = "${local.name_prefix}-lambda-resources"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [aws_s3_bucket.content.arn, "${aws_s3_bucket.content.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"]
        Resource = [aws_dynamodb_table.users.arn, aws_dynamodb_table.lexicons.arn, "${aws_dynamodb_table.lexicons.arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["cognito-idp:AdminGetUser", "cognito-idp:AdminCreateUser"]
        Resource = aws_cognito_user_pool.main.arn
      },
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.content.id}"
      }
    ]
  })
}

resource "aws_lambda_function" "auth" {
  function_name    = "${local.name_prefix}-auth"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "auth.handler"
  filename         = "${path.module}/lambda-src/auth.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-src/auth.zip")

  environment {
    variables = {
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.cli.id
    }
  }
}

resource "aws_lambda_function" "lexicons" {
  function_name    = "${local.name_prefix}-lexicons"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "lexicons.handler"
  filename         = "${path.module}/lambda-src/lexicons.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-src/lexicons.zip")

  environment {
    variables = {
      DYNAMODB_LEXICONS_TABLE = aws_dynamodb_table.lexicons.name
      DYNAMODB_USERS_TABLE    = aws_dynamodb_table.users.name
      COGNITO_USER_POOL_ID    = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID       = aws_cognito_user_pool_client.cli.id
    }
  }
}

resource "aws_lambda_function" "invalidate" {
  function_name    = "${local.name_prefix}-invalidate"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "invalidate.handler"
  filename         = "${path.module}/lambda-src/invalidate.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-src/invalidate.zip")

  environment {
    variables = {
      CLOUDFRONT_DISTRIBUTION_ID = aws_cloudfront_distribution.content.id
    }
  }
}

resource "aws_lambda_permission" "s3_invoke_invalidate" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.invalidate.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.content.arn
}

resource "aws_lambda_function" "sync" {
  function_name    = "${local.name_prefix}-sync"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "sync.handler"
  filename         = "${path.module}/lambda-src/sync.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-src/sync.zip")

  environment {
    variables = {
      S3_BUCKET               = aws_s3_bucket.content.id
      DYNAMODB_LEXICONS_TABLE = aws_dynamodb_table.lexicons.name
      COGNITO_USER_POOL_ID    = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID       = aws_cognito_user_pool_client.cli.id
    }
  }
}

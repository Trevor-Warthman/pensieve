# ── SES email identity ──────────────────────────────────────────────────────────
# AWS will send a verification email — click the link before the first report.

resource "aws_ses_email_identity" "report" {
  email = var.billing_alert_email
}

# ── Lambda ──────────────────────────────────────────────────────────────────────

data "archive_file" "cost_report" {
  type        = "zip"
  source_file = "${path.module}/lambda-src/cost_report.py"
  output_path = "${path.module}/lambda-src/cost_report.zip"
}

resource "aws_iam_role" "cost_report" {
  name = "${local.name_prefix}-cost-report"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cost_report_basic" {
  role       = aws_iam_role.cost_report.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "cost_report" {
  name = "${local.name_prefix}-cost-report"
  role = aws_iam_role.cost_report.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ce:GetCostAndUsage"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail"]
        Resource = aws_ses_email_identity.report.arn
      }
    ]
  })
}

resource "aws_lambda_function" "cost_report" {
  function_name    = "${local.name_prefix}-cost-report"
  role             = aws_iam_role.cost_report.arn
  runtime          = "python3.12"
  handler          = "cost_report.handler"
  filename         = data.archive_file.cost_report.output_path
  source_code_hash = data.archive_file.cost_report.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      REPORT_EMAIL = var.billing_alert_email
    }
  }
}

# ── EventBridge — 1st of every month at 9am ET (2pm UTC) ───────────────────────

resource "aws_cloudwatch_event_rule" "monthly_cost_report" {
  name                = "${local.name_prefix}-monthly-cost-report"
  description         = "Trigger monthly AWS cost report on the 1st of each month"
  schedule_expression = "cron(0 14 1 * ? *)"
}

resource "aws_cloudwatch_event_target" "cost_report" {
  rule      = aws_cloudwatch_event_rule.monthly_cost_report.name
  target_id = "cost-report-lambda"
  arn       = aws_lambda_function.cost_report.arn
}

resource "aws_lambda_permission" "cost_report_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cost_report.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monthly_cost_report.arn
}

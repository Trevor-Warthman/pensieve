# Secret containers — Terraform owns the resources, but NOT the values.
# To set or rotate:
#   aws secretsmanager put-secret-value \
#     --secret-id pensieve/jwt-secret \
#     --secret-string "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${local.name_prefix}/jwt-secret"
  recovery_window_in_days = 0
}

# Allow ECS execution role to read secrets at task startup
resource "aws_iam_role_policy" "ecs_secrets" {
  name = "${local.name_prefix}-ecs-secrets"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.jwt_secret.arn
    }]
  })
}

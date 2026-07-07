# Secret containers — Terraform owns the resources, but NOT the values.
# To set or rotate:
#   aws secretsmanager put-secret-value \
#     --secret-id pensieve/jwt-secret \
#     --secret-string "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${local.name_prefix}/jwt-secret"
  recovery_window_in_days = 0
}

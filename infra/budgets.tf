variable "billing_alert_email" {
  description = "Email address to receive billing alerts"
  type        = string
  default     = "twarthman104@gmail.com"
}

resource "aws_budgets_budget" "monthly" {
  name         = "pensieve-monthly-spend"
  budget_type  = "COST"
  limit_amount = "10"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 1
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.billing_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 1
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.billing_alert_email]
  }
}

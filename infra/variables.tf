variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (empty string = prod, no prefix)"
  type        = string
  default     = ""
}

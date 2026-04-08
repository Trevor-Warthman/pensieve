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

variable "app_image_tag" {
  description = "ECR image tag to deploy"
  type        = string
  default     = "latest"
}

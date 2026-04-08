# ── Remote Terraform State (S3 + DynamoDB lock) ────────────────────────────────
#
# Before running `terraform init` for the first time with this backend, create
# the S3 bucket and DynamoDB table if they don't already exist:
#
#   aws s3api create-bucket \
#     --bucket pensieve-tfstate-931097097534 \
#     --region us-east-1
#
#   aws s3api put-bucket-versioning \
#     --bucket pensieve-tfstate-931097097534 \
#     --versioning-configuration Status=Enabled
#
#   aws s3api put-bucket-encryption \
#     --bucket pensieve-tfstate-931097097534 \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
#   aws dynamodb create-table \
#     --table-name pensieve-tfstate-lock \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region us-east-1
#
# Then migrate existing local state:
#
#   cd infra
#   terraform init -migrate-state
#
# ──────────────────────────────────────────────────────────────────────────────

terraform {
  backend "s3" {
    bucket         = "pensieve-tfstate-931097097534"
    key            = "pensieve/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "pensieve-tfstate-lock"
    encrypt        = true
  }
}

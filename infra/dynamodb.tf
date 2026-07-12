resource "aws_dynamodb_table" "users" {
  name         = "${local.name_prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "byEmail"
    hash_key        = "email"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "lexicons" {
  name         = "${local.name_prefix}-lexicons"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "lexiconId"

  attribute {
    name = "lexiconId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "byUser"
    hash_key        = "userId"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "device_codes" {
  name         = "${local.name_prefix}-device-codes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "deviceCode"

  attribute {
    name = "deviceCode"
    type = "S"
  }

  attribute {
    name = "userCode"
    type = "S"
  }

  global_secondary_index {
    name            = "byUserCode"
    hash_key        = "userCode"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

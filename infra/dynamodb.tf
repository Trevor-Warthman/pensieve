resource "aws_dynamodb_table" "users" {
  name         = "${local.name_prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
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

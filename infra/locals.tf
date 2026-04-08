locals {
  # Produces "pensieve" when environment is "" (existing prod resources)
  # or "pensieve-dev" / "pensieve-staging" when environment is set.
  name_prefix = var.environment != "" ? "pensieve-${var.environment}" : "pensieve"
}

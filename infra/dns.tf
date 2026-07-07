# pensieve.click — registered manually via `aws route53domains register-domain`
# (Terraform's aws_route53domains_registered_domain resource can only manage a
# domain that's already registered, it can't purchase one). This codifies the
# settings we want going forward and points the domain at the OpenNext app.

resource "aws_route53domains_registered_domain" "pensieve_click" {
  domain_name = "pensieve.click"
  auto_renew  = true

  admin_privacy      = true
  registrant_privacy = true
  tech_privacy       = true
}

# Route53 auto-creates a hosted zone matching the domain name on registration.
data "aws_route53_zone" "pensieve_click" {
  name = "pensieve.click"
}

# CloudFront requires the cert in us-east-1 regardless of distribution region —
# matches this project's default region already, no provider alias needed.
resource "aws_acm_certificate" "pensieve_click" {
  domain_name               = "pensieve.click"
  subject_alternative_names = ["www.pensieve.click"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "pensieve_click_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.pensieve_click.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = data.aws_route53_zone.pensieve_click.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "pensieve_click" {
  certificate_arn         = aws_acm_certificate.pensieve_click.arn
  validation_record_fqdns = [for r in aws_route53_record.pensieve_click_cert_validation : r.fqdn]
}

resource "aws_route53_record" "pensieve_click_root" {
  zone_id = data.aws_route53_zone.pensieve_click.zone_id
  name    = "pensieve.click"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "pensieve_click_www" {
  zone_id = data.aws_route53_zone.pensieve_click.zone_id
  name    = "www.pensieve.click"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

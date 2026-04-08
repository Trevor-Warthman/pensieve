# ── GitHub Actions OIDC Federation ─────────────────────────────────────────────
#
# Allows GitHub Actions workflows in Trevor-Warthman/pensieve to assume an IAM
# role directly via OIDC — no stored AWS credentials required in GitHub Secrets.
#
# Bootstrap (one-time, before the first pipeline run):
#
#   cd infra
#   terraform init
#   terraform apply -target=aws_iam_openid_connect_provider.github \
#                   -target=aws_iam_role.github_actions \
#                   -target=aws_iam_role_policy.github_actions
#
# After that, every push to main (or any branch for PRs) authenticates via OIDC.
#
# ──────────────────────────────────────────────────────────────────────────────

# GitHub's OIDC thumbprints — these are the well-known values published by GitHub.
# See: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

# The role GitHub Actions will assume.
# The subject condition uses a wildcard so it covers pushes to main AND PR
# preview workflows (repo:Trevor-Warthman/pensieve:ref:refs/heads/*, etc.).
resource "aws_iam_role" "github_actions" {
  name = "pensieve-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "GitHubOIDC"
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:Trevor-Warthman/pensieve:*"
        }
      }
    }]
  })
}

# Inline policy granting everything the deploy pipeline needs.
resource "aws_iam_role_policy" "github_actions" {
  name = "pensieve-github-actions-deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [

      # ── ECR ────────────────────────────────────────────────────────────────
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:DescribeRepositories",
          "ecr:CreateRepository",
          "ecr:DeleteRepository",
          "ecr:ListImages",
        ]
        Resource = ["arn:aws:ecr:us-east-1:931097097534:repository/pensieve-app"]
      },

      # ── ECS ────────────────────────────────────────────────────────────────
      {
        Sid    = "ECS"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:ListTaskDefinitions",
          "ecs:DescribeTaskDefinition",
          "ecs:CreateCluster",
          "ecs:DeleteCluster",
          "ecs:DescribeClusters",
          "ecs:ListClusters",
          "ecs:CreateService",
          "ecs:DeleteService",
          "ecs:ListServices",
          "ecs:TagResource",
          "ecs:UntagResource",
        ]
        Resource = ["*"]
      },

      # ── Lambda ─────────────────────────────────────────────────────────────
      {
        Sid    = "Lambda"
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:GetFunction",
          "lambda:CreateFunction",
          "lambda:DeleteFunction",
          "lambda:UpdateFunctionConfiguration",
          "lambda:GetFunctionConfiguration",
          "lambda:AddPermission",
          "lambda:RemovePermission",
          "lambda:ListFunctions",
          "lambda:GetPolicy",
          "lambda:TagResource",
          "lambda:UntagResource",
          "lambda:ListTags",
          "lambda:PublishVersion",
          "lambda:CreateEventSourceMapping",
          "lambda:DeleteEventSourceMapping",
          "lambda:GetEventSourceMapping",
          "lambda:ListEventSourceMappings",
          "lambda:ListVersionsByFunction",
          "lambda:GetFunctionCodeSigningConfig",
        ]
        Resource = ["arn:aws:lambda:us-east-1:931097097534:function:pensieve-*"]
      },

      # ── IAM PassRole (scoped to ECS execution + task roles) ────────────────
      {
        Sid    = "IAMPassRole"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          "arn:aws:iam::931097097534:role/pensieve-ecs-execution",
          "arn:aws:iam::931097097534:role/pensieve-ecs-task",
          "arn:aws:iam::931097097534:role/pensieve-*",
        ]
      },
      # IAM management for Terraform-managed roles/policies
      {
        Sid    = "IAMManage"
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:GetRole",
          "iam:UpdateRole",
          "iam:ListRoles",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:GetRolePolicy",
          "iam:ListRolePolicies",
          "iam:ListAttachedRolePolicies",
          "iam:CreatePolicy",
          "iam:DeletePolicy",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListPolicies",
          "iam:ListPolicyVersions",
          "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:TagPolicy",
          "iam:UntagPolicy",
          "iam:CreateOpenIDConnectProvider",
          "iam:DeleteOpenIDConnectProvider",
          "iam:GetOpenIDConnectProvider",
          "iam:UpdateOpenIDConnectProviderThumbprint",
          "iam:AddClientIDToOpenIDConnectProvider",
          "iam:RemoveClientIDFromOpenIDConnectProvider",
          "iam:ListOpenIDConnectProviders",
          "iam:TagOpenIDConnectProvider",
        ]
        Resource = ["*"]
      },

      # ── S3 — Terraform state backend (broad) ───────────────────────────────
      {
        Sid    = "S3TFState"
        Effect = "Allow"
        Action = ["s3:*"]
        Resource = [
          "arn:aws:s3:::pensieve-tfstate-931097097534",
          "arn:aws:s3:::pensieve-tfstate-931097097534/*",
        ]
      },
      # S3 — application content bucket
      {
        Sid    = "S3Content"
        Effect = "Allow"
        Action = ["s3:*"]
        Resource = [
          "arn:aws:s3:::pensieve-content-931097097534",
          "arn:aws:s3:::pensieve-content-931097097534/*",
        ]
      },

      # ── DynamoDB — Terraform state lock (broad) ────────────────────────────
      {
        Sid    = "DynamoDBTFLock"
        Effect = "Allow"
        Action = ["dynamodb:*"]
        Resource = [
          "arn:aws:dynamodb:us-east-1:931097097534:table/pensieve-tfstate-lock",
        ]
      },
      # DynamoDB — application tables
      {
        Sid    = "DynamoDBApp"
        Effect = "Allow"
        Action = [
          "dynamodb:CreateTable",
          "dynamodb:DeleteTable",
          "dynamodb:DescribeTable",
          "dynamodb:UpdateTable",
          "dynamodb:ListTables",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:TagResource",
          "dynamodb:UntagResource",
          "dynamodb:ListTagsOfResource",
          "dynamodb:DescribeTimeToLive",
          "dynamodb:UpdateTimeToLive",
          "dynamodb:DescribeContinuousBackups",
          "dynamodb:UpdateContinuousBackups",
        ]
        Resource = [
          "arn:aws:dynamodb:us-east-1:931097097534:table/pensieve-users",
          "arn:aws:dynamodb:us-east-1:931097097534:table/pensieve-users/*",
          "arn:aws:dynamodb:us-east-1:931097097534:table/pensieve-lexicons",
          "arn:aws:dynamodb:us-east-1:931097097534:table/pensieve-lexicons/*",
        ]
      },

      # ── CloudFront ─────────────────────────────────────────────────────────
      {
        Sid    = "CloudFront"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:GetDistributionConfig",
          "cloudfront:CreateDistribution",
          "cloudfront:UpdateDistribution",
          "cloudfront:DeleteDistribution",
          "cloudfront:ListDistributions",
          "cloudfront:TagResource",
          "cloudfront:UntagResource",
          "cloudfront:ListTagsForResource",
          "cloudfront:CreateOriginAccessControl",
          "cloudfront:DeleteOriginAccessControl",
          "cloudfront:GetOriginAccessControl",
          "cloudfront:UpdateOriginAccessControl",
          "cloudfront:ListOriginAccessControls",
          "cloudfront:CreateCachePolicy",
          "cloudfront:DeleteCachePolicy",
          "cloudfront:GetCachePolicy",
          "cloudfront:UpdateCachePolicy",
          "cloudfront:ListCachePolicies",
        ]
        Resource = ["*"]
      },

      # ── Secrets Manager ────────────────────────────────────────────────────
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:CreateSecret",
          "secretsmanager:DeleteSecret",
          "secretsmanager:UpdateSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:ListSecrets",
          "secretsmanager:TagResource",
          "secretsmanager:UntagResource",
        ]
        Resource = ["arn:aws:secretsmanager:us-east-1:931097097534:secret:pensieve-*"]
      },

      # ── API Gateway ────────────────────────────────────────────────────────
      {
        Sid      = "APIGateway"
        Effect   = "Allow"
        Action   = ["apigateway:*"]
        Resource = ["arn:aws:apigateway:us-east-1::/*"]
      },

      # ── Cognito ────────────────────────────────────────────────────────────
      {
        Sid    = "Cognito"
        Effect = "Allow"
        Action = [
          "cognito-idp:CreateUserPool",
          "cognito-idp:DeleteUserPool",
          "cognito-idp:DescribeUserPool",
          "cognito-idp:UpdateUserPool",
          "cognito-idp:ListUserPools",
          "cognito-idp:CreateUserPoolClient",
          "cognito-idp:DeleteUserPoolClient",
          "cognito-idp:DescribeUserPoolClient",
          "cognito-idp:UpdateUserPoolClient",
          "cognito-idp:ListUserPoolClients",
          "cognito-idp:TagResource",
          "cognito-idp:UntagResource",
          "cognito-idp:ListTagsForResource",
          "cognito-idp:GetUserPoolMfaConfig",
          "cognito-idp:SetUserPoolMfaConfig",
        ]
        Resource = ["*"]
      },

      # ── EC2 / VPC (ECS networking, ALB) ────────────────────────────────────
      {
        Sid    = "EC2Networking"
        Effect = "Allow"
        Action = [
          "ec2:DescribeVpcs",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeRouteTables",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeNetworkInterfaces",
          "ec2:CreateSecurityGroup",
          "ec2:DeleteSecurityGroup",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupEgress",
          "ec2:CreateTags",
          "ec2:DeleteTags",
          "ec2:DescribeTags",
        ]
        Resource = ["*"]
      },

      # ── ELB (ALB) ──────────────────────────────────────────────────────────
      {
        Sid    = "ELB"
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:*",
        ]
        Resource = ["*"]
      },

      # ── CloudWatch Logs (ECS task logs) ────────────────────────────────────
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:DescribeLogGroups",
          "logs:PutRetentionPolicy",
          "logs:TagResource",
          "logs:UntagResource",
          "logs:ListTagsForResource",
          "logs:ListTagsLogGroup",
          "logs:TagLogGroup",
          "logs:UntagLogGroup",
        ]
        Resource = ["*"]
      },

      # ── STS — identity check (used by pipeline to derive account ID) ───────
      {
        Sid    = "STSGetCallerIdentity"
        Effect = "Allow"
        Action = ["sts:GetCallerIdentity"]
        Resource = ["*"]
      },

      # ── Budgets ────────────────────────────────────────────────────────────
      {
        Sid    = "Budgets"
        Effect = "Allow"
        Action = [
          "budgets:CreateBudget",
          "budgets:DeleteBudget",
          "budgets:DescribeBudget",
          "budgets:ModifyBudget",
          "budgets:ViewBudget",
          "budgets:ListTagsForResource",
          "budgets:TagResource",
          "budgets:UntagResource",
        ]
        Resource = ["*"]
      },

      # ── SES ────────────────────────────────────────────────────────────────
      {
        Sid    = "SES"
        Effect = "Allow"
        Action = [
          "ses:GetIdentityVerificationAttributes",
          "ses:VerifyEmailIdentity",
          "ses:DeleteIdentity",
          "ses:ListIdentities",
          "ses:GetIdentityDkimAttributes",
          "ses:GetIdentityMailFromDomainAttributes",
          "ses:GetIdentityNotificationAttributes",
          "ses:SetIdentityFeedbackForwardingEnabled",
          "ses:SendEmail",
          "ses:SendRawEmail",
        ]
        Resource = ["*"]
      },

      # ── EventBridge ────────────────────────────────────────────────────────
      {
        Sid    = "EventBridge"
        Effect = "Allow"
        Action = [
          "events:DescribeRule",
          "events:PutRule",
          "events:DeleteRule",
          "events:ListRules",
          "events:PutTargets",
          "events:RemoveTargets",
          "events:ListTargetsByRule",
          "events:TagResource",
          "events:UntagResource",
          "events:ListTagsForResource",
        ]
        Resource = ["*"]
      },
    ]
  })
}

#!/usr/bin/env bash
set -euo pipefail

# ── Pensieve production deploy script ──────────────────────────────────────────
# NOTE: This script is superseded by the GitHub Actions pipeline at
#       .github/workflows/deploy.yml, which runs automatically on every push
#       to main. Keep this file as a local emergency fallback only.
#
# Usage:
#   export JWT_SECRET=<your-secret>
#   ./deploy.sh [image-tag]          # defaults to 'latest'
#
# Requires: aws cli, docker, terraform

IMAGE_TAG="${1:-latest}"

# ── Derive values from Terraform outputs ───────────────────────────────────────

echo "→ Reading Terraform outputs..."
cd "$(dirname "$0")/infra"

ECR_URL=$(terraform output -raw ecr_repository_url)
AWS_REGION=$(terraform output -raw -json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('region',{}).get('value','us-east-1'))" 2>/dev/null || echo "us-east-1")
CLUSTER="pensieve"
SERVICE="pensieve-app"

cd "$(dirname "$0")"

# ── Build & push Docker image ──────────────────────────────────────────────────

echo "→ Logging into ECR..."
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin "$ECR_URL"

echo "→ Building Docker image..."
docker build -t "pensieve-app:$IMAGE_TAG" ./app

echo "→ Tagging and pushing $ECR_URL:$IMAGE_TAG..."
docker tag "pensieve-app:$IMAGE_TAG" "$ECR_URL:$IMAGE_TAG"
docker push "$ECR_URL:$IMAGE_TAG"

# ── Apply Terraform ────────────────────────────────────────────────────────────

echo "→ Applying Terraform..."
cd infra
terraform apply \
  -var="app_image_tag=$IMAGE_TAG" \
  -auto-approve

ALB_DNS=$(terraform output -raw alb_dns_name)
cd ..

# ── Force ECS redeploy ─────────────────────────────────────────────────────────

echo "→ Forcing ECS service redeployment..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --region us-east-1 \
  --output json | python3 -c "
import sys, json
s = json.load(sys.stdin)['service']
print(f\"  Service: {s['serviceName']}\")
print(f\"  Status:  {s['status']}\")
print(f\"  Running: {s['runningCount']}/{s['desiredCount']} tasks\")
"

echo ""
echo "✓ Deploy complete"
echo "  App: http://$ALB_DNS"
echo ""
echo "  Monitor rollout:"
echo "  aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].{running:runningCount,desired:desiredCount,pending:pendingCount}'"

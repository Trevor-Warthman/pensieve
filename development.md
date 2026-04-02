# Development

Day-to-day workflow for running Pensieve locally.

First time on this machine? Do [local-setup.md](local-setup.md) first.

---

## Starting the app

```bash
# Open Docker Desktop and wait for the whale icon to steady, then:
docker compose up -d
```

App is at **http://localhost:3000**. That's it — DynamoDB, table setup, and Next.js all start together.

On first run `docker compose up` will build the image (~30s). Subsequent starts use the cache and are fast.

To follow logs:

```bash
docker compose logs -f app   # Next.js output + table creation on startup
```

---

## Using the app

| URL | What it is |
|---|---|
| `http://localhost:3000` | Home |
| `http://localhost:3000/register` | Create an account |
| `http://localhost:3000/login` | Sign in |
| `http://localhost:3000/dashboard` | Manage your Lexicons |

Register first — there are no seeded accounts. Registration logs you in immediately (no email verification locally).

---

## How local auth differs from production

In production, auth goes through AWS Cognito (Lambda → Cognito → JWT). Locally, the app's own Next.js API routes handle everything:

| | Local | Production |
|---|---|---|
| Auth | bcrypt + JWT (`JWT_SECRET`) | AWS Cognito |
| Database | DynamoDB Local on port 8000 | AWS DynamoDB |
| API | Next.js `/api/*` routes | API Gateway → Lambda |
| Users table | `pensieve-dev-users` (DynamoDB Local) | Cognito user pool |

The JWT payload shape is identical in both environments (`sub` = userId), so all lexicon logic works the same way.

---

## Stopping

```bash
docker compose down   # stops everything; DynamoDB data is lost (in-memory)
docker compose stop   # pause without removing; data survives
```

After `docker compose down`, tables are recreated automatically next time you `docker compose up`.

---

## Running tests

Requires the Docker stack to be running (`docker compose up -d`).

```bash
cd app

# Run all Playwright e2e tests (reuses the running dev server)
npx playwright test

# Run a specific test file
npx playwright test e2e/auth-local.spec.ts

# Open the Playwright UI
npx playwright test --ui
```

---

## Environment variables

All local env vars live in `app/.env.local`. Do not commit secrets — `JWT_SECRET` is fine as-is for local dev, but set a real secret in any deployed environment.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Where the frontend sends API requests (`/api` locally, API Gateway in prod) |
| `DYNAMODB_ENDPOINT` | Points the AWS SDK at DynamoDB Local instead of real AWS |
| `DYNAMODB_LEXICONS_TABLE` | Table name for lexicons |
| `DYNAMODB_USERS_TABLE` | Table name for users (local only — Cognito handles this in prod) |
| `JWT_SECRET` | Signs/verifies JWTs locally (Cognito does this in prod) |

---

## Deploying to AWS

See [infra/](infra/) for Terraform. Resources are environment-scoped — `dev` and `prod` can coexist in the same AWS account.

```bash
cd infra
terraform init

# First time for an environment
terraform workspace new prod
terraform workspace select prod
terraform apply -var="environment=prod"

# After apply, copy outputs into app/.env.local (or deployment env vars)
terraform output
```

Outputs to set:
- `api_endpoint` → `NEXT_PUBLIC_API_URL`
- `cloudfront_domain` → `NEXT_PUBLIC_CLOUDFRONT_URL`
- `s3_bucket_name` → `AWS_S3_BUCKET`
- `dynamodb_lexicons_table` → `DYNAMODB_LEXICONS_TABLE`

Remove `DYNAMODB_ENDPOINT`, `DYNAMODB_USERS_TABLE`, and `JWT_SECRET` from the deployed environment — those are local-only.

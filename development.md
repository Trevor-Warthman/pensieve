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

## Using the CLI locally

The CLI lives in `cli/`. Build it once before use, then rebuild whenever you change CLI source.

```bash
cd cli
npm install
npm run build   # outputs to cli/dist/index.js
```

### 1. Point the CLI at the local server

```bash
node dist/index.js config init --api-endpoint http://localhost:3000/api
```

### 2. Create an account and log in

Register (skips email confirmation locally):

```bash
node dist/index.js register --local
```

Or if you already have an account:

```bash
node dist/index.js login --local
```

`--local` routes auth through the Next.js API instead of AWS Cognito. It only works when `apiEndpoint` is `localhost`.

### 3. Sync a vault

```bash
node dist/index.js sync /path/to/your/vault --lexicon <slug>
```

- The lexicon must already exist (create it at http://localhost:3000/dashboard first).
- Re-running sync skips unchanged files (compares MD5 against S3 ETags).
- `--dry-run` lists what would be uploaded without touching anything.

### Running the CLI from anywhere during development

Add a shell alias so you don't have to type the full path:

```bash
alias pensieve="node $(pwd)/dist/index.js"
```

Or use `npm link` in the `cli/` directory to install it as a global `pensieve` command.

---

## Publishing the CLI to npm

When the CLI is ready for real users, publish it to npm so they can install it with:

```bash
npm install -g pensieve-markdown
```

The package is named `pensieve-markdown` (`pensieve` and `pensieve-cli` are already taken on npm). The installed binary is still called `pensieve`.

### Before publishing

**1. Verify the name is still available**

```bash
npm show pensieve-markdown
```

**2. Fill in the missing package.json fields**

Open `cli/package.json` and add:

```json
"author": "Your Name <you@example.com>",
"repository": {
  "type": "git",
  "url": "https://github.com/your-org/pensieve"
},
"homepage": "https://github.com/your-org/pensieve#readme"
```

**3. Make sure the version is right**

`package.json` currently has `"version": "0.1.0"`. That's fine for a first publish. Subsequent releases: bump the version before publishing.

```bash
cd cli
npm version patch   # 0.1.0 → 0.1.1 (bug fix)
npm version minor   # 0.1.0 → 0.2.0 (new feature)
npm version major   # 0.1.0 → 1.0.0 (breaking change)
```

Each of these commits the bump and tags the git commit automatically.

### Publishing

```bash
npm login          # one-time — logs you into npmjs.com
cd cli
npm publish        # runs `npm run build` first via prepublishOnly, then uploads
```

### What gets published

Only the `dist/` directory is included (controlled by the `"files"` field in `package.json`). TypeScript source is not shipped. The `bin.pensieve` field wires up the `pensieve` command automatically when installed globally.

### Subsequent releases

```bash
cd cli
npm version patch
npm publish
git push && git push --tags
```

### GitHub Actions (optional)

To automate releases, add a workflow that runs `npm publish` on a new tag push. The workflow needs an `NPM_TOKEN` secret (create at npmjs.com → Access Tokens → Automation token, add to GitHub repo secrets).

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

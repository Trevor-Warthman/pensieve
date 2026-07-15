# Local Setup

Everything you need to do once when setting up this project on a new machine.

---

## 1. Install prerequisites

### Docker Desktop
Required to run DynamoDB locally. Free for personal use.

1. Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Install and launch Docker Desktop
3. Wait for the whale icon in the menu bar to stop animating before proceeding

### Node.js
Version 20 or higher. Download from [nodejs.org](https://nodejs.org), or use a version manager like `nvm`:

```bash
nvm install 20
nvm use 20
```

---

## 2. Install dependencies

```bash
cd app
npm install
```

---

## 3. Verify Docker works

```bash
docker compose up -d
docker compose logs app
```

You should see the app log `[db] created table: pensieve-dev-users` and `[db] created table: pensieve-dev-lexicons` on first start. Tables are created by the app itself on startup — no separate step needed.

---

## 4. Create `.env.local`

`app/.env.local` is gitignored (`.env*.local`), not committed — create it yourself with:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
AWS_REGION=us-east-1
DYNAMODB_ENDPOINT=http://localhost:8000
DYNAMODB_LEXICONS_TABLE=pensieve-dev-lexicons
DYNAMODB_USERS_TABLE=pensieve-dev-users
JWT_SECRET=local-dev-secret-change-me
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_S3_ENDPOINT=http://localhost:9000
AWS_S3_PUBLIC_ENDPOINT=http://localhost:9000
AWS_S3_BUCKET=pensieve-local
NEXT_PUBLIC_CLOUDFRONT_URL=http://localhost:9000/pensieve-local
```

The app runs on port **3001**, not 3000 (`npm run dev` / `docker-compose.yml`). `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` must match minio's `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` (`minioadmin`/`minioadmin`) — the app code defaults to `local`/`local` when unset, which minio rejects with `InvalidAccessKeyId`.

---

Setup is done. See [development.md](development.md) for how to run the app day-to-day.

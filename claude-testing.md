# Claude Testing Notes

## CLI E2E Test

The CLI sync flow is covered by `app/e2e/cli.spec.ts`. Run it with:

```bash
cd app
npx playwright test e2e/cli.spec.ts
```

Requires the Docker stack to be running (`docker compose up -d`).

The test:
1. Registers a fresh ephemeral user via the local API
2. Creates a lexicon
3. Syncs `/Users/trevor/Development/test-markdown` (5 files)
4. Verifies notes render in the browser
5. Verifies re-sync skips unchanged files
6. Verifies `--dry-run` doesn't upload

Test users are created with a timestamp-based ID (`cli-e2e-<runid>@example.com`) so runs don't conflict. No standing test user needed — credentials are seeded and torn down per run.

All 5 tests passed on 2026-04-02.

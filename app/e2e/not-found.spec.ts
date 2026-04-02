import { test, expect } from '@playwright/test';

// Lexicon pages hit DynamoDB — in dev (no live infra) they return 500,
// in production they return 404. Either signals the resource doesn't exist.
test('unknown lexicon returns error page', async ({ page }) => {
  const res = await page.goto('/this-lexicon-does-not-exist-xyz');
  expect(res?.status()).toBeGreaterThanOrEqual(400);
});

test('unknown nested note returns error page', async ({ page }) => {
  const res = await page.goto('/this-lexicon-does-not-exist-xyz/some/note');
  expect(res?.status()).toBeGreaterThanOrEqual(400);
});

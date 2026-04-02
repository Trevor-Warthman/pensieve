/**
 * E2E: Full new-lexicon flow
 *
 * Registers a user, creates a lexicon, verifies:
 * - Dashboard shows NextSteps after creation
 * - /setup page loads without 404
 * - /{slug} page loads without 404 even with no notes
 * - A second lexicon (not first in table) also resolves (was broken by Limit:1 scan bug)
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// Generate unique slugs per test run to avoid DynamoDB collisions
const RUN_ID = Date.now().toString(36);
const EMAIL = `flow-test-${RUN_ID}@example.com`;
const PASSWORD = 'TestPassword123!';
const SLUG1 = `lexicon-a-${RUN_ID}`;
const SLUG2 = `lexicon-b-${RUN_ID}`;

async function registerAndLogin(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  // Should land on dashboard after registration
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe('new lexicon flow', () => {
  test.beforeAll(async ({ browser }) => {
    // Register once; tests share this account via storage state isn't set up,
    // so each test re-logs in via cookie seeding after first registration.
  });

  test('register → create lexicon → NextSteps shown', async ({ page }) => {
    await registerAndLogin(page, EMAIL, PASSWORD);
    await page.getByRole('button', { name: 'New Lexicon' }).first().click();
    await page.getByPlaceholder('My Notes').fill('Flow Test A');
    await page.getByPlaceholder('my-notes').fill(SLUG1);
    await page.getByRole('button', { name: 'Create' }).click();

    // NextSteps view should appear
    await expect(page.getByText('Lexicon created', { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Sync Your Notes')).toBeVisible();
    await expect(page.getByText(SLUG1)).toBeVisible();
  });

  test('/setup page loads (no 404)', async ({ page }) => {
    await page.goto('/setup');
    await expect(page).not.toHaveURL(/login/);
    expect((await page.request.get('/setup')).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Installing the CLI' })).toBeVisible();
  });

  test('/{slug} loads after creation with no notes (no 404)', async ({ page }) => {
    await registerAndLogin(page, `no-notes-${RUN_ID}@example.com`, PASSWORD);

    // Create lexicon
    await page.getByRole('button', { name: 'New Lexicon' }).first().click();
    await page.getByPlaceholder('My Notes').fill('Empty Lexicon');
    const emptySlug = `empty-${RUN_ID}`;
    await page.getByPlaceholder('my-notes').fill(emptySlug);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Lexicon created', { exact: false })).toBeVisible({ timeout: 10000 });

    // Navigate to the lexicon URL
    await page.goto(`/${emptySlug}`);
    const status = (await page.request.get(`/${emptySlug}`)).status();
    expect(status).toBeLessThan(400);
    await expect(page.getByText('No published notes yet')).toBeVisible();
  });

  test('second lexicon resolves (Limit:1 scan bug regression)', async ({ page }) => {
    // This test validates the fix for the Limit:1 DynamoDB scan bug.
    // The second lexicon created (not first in table) was always 404ing.
    await registerAndLogin(page, `regression-${RUN_ID}@example.com`, PASSWORD);

    // Create first lexicon
    await page.getByRole('button', { name: 'New Lexicon' }).first().click();
    await page.getByPlaceholder('My Notes').fill('Regression First');
    const slug1 = `reg-first-${RUN_ID}`;
    await page.getByPlaceholder('my-notes').fill(slug1);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Lexicon created', { exact: false })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Go to Dashboard' }).click();

    // Create second lexicon
    await page.getByRole('button', { name: 'New Lexicon' }).first().click();
    await page.getByPlaceholder('My Notes').fill('Regression Second');
    const slug2 = `reg-second-${RUN_ID}`;
    await page.getByPlaceholder('my-notes').fill(slug2);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Lexicon created', { exact: false })).toBeVisible({ timeout: 10000 });

    // Both should resolve without 404
    const res1 = await page.request.get(`/${slug1}`);
    const res2 = await page.request.get(`/${slug2}`);
    expect(res1.status()).toBeLessThan(400);
    expect(res2.status()).toBeLessThan(400);
  });
});

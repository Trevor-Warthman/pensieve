import { test, expect } from '@playwright/test';

// Dashboard requires auth cookie — set one before each test
test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{
    name: 'pensieve_token',
    value: 'test-token',
    domain: 'localhost',
    path: '/',
  }]);
});

test('dashboard page loads and shows heading', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('dashboard shows New Lexicon button', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'New Lexicon' })).toBeVisible();
});

test('dashboard create form appears on button click', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'New Lexicon' }).click();
  await expect(page.getByRole('heading', { name: 'New Lexicon' })).toBeVisible();
  await expect(page.getByPlaceholder('My Notes')).toBeVisible();
  await expect(page.getByPlaceholder('my-notes')).toBeVisible();
});

test('dashboard create form auto-derives slug from title', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'New Lexicon' }).click();
  await page.getByPlaceholder('My Notes').fill('My DnD Campaign');
  await expect(page.getByPlaceholder('my-notes')).toHaveValue('my-dnd-campaign');
});

test('dashboard cancel returns to list view', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'New Lexicon' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'New Lexicon' })).toBeVisible();
});

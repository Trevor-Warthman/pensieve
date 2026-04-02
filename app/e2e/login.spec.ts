import { test, expect } from '@playwright/test';

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('login page shows error on bad credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('bad@example.com');
  await page.getByLabel('Password').fill('wrongpassword');
  await page.getByRole('button', { name: /sign in/i }).click();
  // Should show an error (API call will fail in dev — any error message is acceptable)
  await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 10000 });
});

test('dashboard redirects to login when unauthenticated', async ({ page }) => {
  // Ensure no cookie is set
  await page.context().clearCookies();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

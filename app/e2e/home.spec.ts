import { test, expect } from '@playwright/test';

test('homepage shows Pensieve heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pensieve' })).toBeVisible();
});

test('homepage shows tagline', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Pour your notes in')).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('homepage has Pensieve in title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Pensieve/);
});

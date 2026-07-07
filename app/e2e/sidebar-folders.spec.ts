import { test, expect } from '@playwright/test';

const LEXICON = 'test-lexicon';

test('folder in sidebar renders as a button, not a link', async ({ page }) => {
  await page.goto(`/${LEXICON}/index`);
  await expect(page.getByRole('button', { name: 'guides' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'guides' })).toHaveCount(0);
});

test('clicking a folder toggles its children without navigating', async ({ page }) => {
  await page.goto(`/${LEXICON}/index`);
  const folderButton = page.getByRole('button', { name: 'guides' });
  const childLink = page.getByRole('link', { name: 'Setup Guide' });

  await expect(childLink).toBeVisible();
  await folderButton.click();
  await expect(childLink).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${LEXICON}/index$`));

  await folderButton.click();
  await expect(childLink).toBeVisible();
});

test('note nested under a folder loads without a 404', async ({ page }) => {
  const res = await page.goto(`/${LEXICON}/guides/setup`);
  expect(res!.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'Setup Guide' })).toBeVisible();
});

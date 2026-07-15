import { test, expect } from '@playwright/test';

const LEXICON = 'test-lexicon';

test('lexicon index redirects to or loads the first note', async ({ page }) => {
  const res = await page.goto(`/${LEXICON}`);
  // Either 200 (index note) or redirect — no server error
  expect(res!.status()).toBeLessThan(500);
});

test('lexicon shows sidebar with note links', async ({ page }) => {
  await page.goto(`/${LEXICON}/index`);
  // Sidebar should contain at least the seeded published notes
  await expect(page.getByRole('link', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Second Note' })).toBeVisible();
});

test('lexicon note renders markdown content', async ({ page }) => {
  await page.goto(`/${LEXICON}/index`);
  await expect(page.getByRole('heading', { name: 'Welcome to the Test Lexicon' })).toBeVisible();
});

test('hidden note is not in sidebar', async ({ page }) => {
  await page.goto(`/${LEXICON}/index`);
  await expect(page.getByRole('link', { name: 'Hidden Note' })).not.toBeVisible();
});

test('hidden note returns 404', async ({ page }) => {
  const res = await page.goto(`/${LEXICON}/hidden`);
  expect(res!.status()).toBeGreaterThanOrEqual(400);
});

test('second note has backlink to index', async ({ page }) => {
  await page.goto(`/${LEXICON}/second-note`);
  // Backlinks aside should contain a link to "index"
  await expect(page.locator('aside').getByRole('link', { name: 'index' })).toBeVisible();
});

test('pinned notes show in a Pinned section above the general list, ordered by pinOrder', async ({ page }) => {
  await page.goto(`/${LEXICON}`);

  const pinnedSection = page.getByTestId('pinned-section');
  const pinnedLinks = pinnedSection.getByRole('link');

  // pinOrder: 1 before pinOrder: 2, regardless of file/seed order (seeded as second, then first).
  await expect(pinnedLinks).toHaveText([/Pinned First/, /Pinned Second/]);
});

test('pinned notes do not also appear in the general list', async ({ page }) => {
  await page.goto(`/${LEXICON}`);

  const pinnedSection = page.getByTestId('pinned-section');
  const generalList = page.getByTestId('general-list');

  await expect(pinnedSection.getByRole('link', { name: 'Pinned First' })).toBeVisible();
  await expect(generalList.getByRole('link', { name: 'Pinned First' })).toHaveCount(0);
});

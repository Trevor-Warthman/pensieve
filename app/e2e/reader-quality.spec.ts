import { expect, test } from '@playwright/test';

const lexicon = '/test-lexicon';

test('quick search ranks the matching title, responds to Enter and restores focus on Escape', async ({ page }) => {
  await page.goto(`${lexicon}/index`);
  const trigger = page.getByRole('button', { name: /open page search/i });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Find a note' });
  const input = dialog.getByRole('searchbox');
  await expect(input).toBeFocused();
  await input.fill('setup guide');
  await expect(dialog.getByRole('list', { name: 'Suggested notes' }).getByRole('link').first()).toContainText('Setup Guide');
  await input.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Control+k');
  await input.fill('setpu');
  await expect(dialog.getByRole('link', { name: /Setup Guide/ })).toBeVisible();
  await input.press('Enter');
  await expect(page).toHaveURL(`${lexicon}/guides/setup`);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('guides')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'guides' })).toHaveCount(0);
});

test('fallback to note-text search keeps the query and finds words across title, tag, path and excerpt', async ({ page }) => {
  await page.goto(`${lexicon}/index`);
  await page.getByRole('button', { name: /open page search/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('searchbox').fill('api login flows');
  await expect(dialog.getByRole('status')).toContainText('No matching titles');
  await dialog.getByRole('link', { name: /Search note text for/ }).click();
  await expect(page).toHaveURL(`${lexicon}/search?q=api%20login%20flows`);
  const results = page.getByRole('list', { name: 'Search results' });
  await expect(results.getByRole('link')).toHaveCount(1);
  await expect(results.getByRole('link', { name: /Authentication/ })).toContainText('api/authentication');
  await expect(results.getByRole('link').locator('mark').filter({ hasText: 'login' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('Hidden Note');
  await expect(page.getByRole('status')).toContainText('No results');
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('Secret Note');
  await expect(results.getByRole('link')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByRole('status')).toContainText('published notes by title');
});

test('manifest-backed search shows the public excerpt and ignores text inside comments', async ({ page }) => {
  await page.goto('/manifest-lexicon/search?q=meridian&q=ignored');
  const results = page.getByRole('list', { name: 'Search results' });
  await expect(page.getByRole('searchbox')).toHaveValue('meridian');
  await expect(results.getByRole('link')).toContainText('Reading Notes');
  await expect(results).not.toContainText('fixture-not-in-search');
  await page.getByRole('searchbox').fill('fixture-not-in-search');
  await expect(page.getByRole('status')).toContainText('No results');
  await page.goto('/manifest-lexicon/old');
  await expect(page.getByRole('heading', { name: 'Old Note' })).toHaveCount(0);
});

test('wikilinks keep the reader mounted and browser Back restores the original note', async ({ page }) => {
  await page.goto(`${lexicon}/index`);
  const sidebar = page.getByRole('navigation', { name: 'Test Lexicon navigation' });
  await sidebar.getByRole('tab', { name: 'bookmarks' }).click();
  const documentRequests: string[] = [];
  page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document') documentRequests.push(request.url()); });
  await page.locator('article').getByRole('link', { name: 'second-note' }).click();
  await expect(page).toHaveURL(`${lexicon}/second-note`);
  await expect(sidebar.getByRole('tab', { name: 'bookmarks' })).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page.getByRole('main').getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
  expect(documentRequests).toEqual([]);
});

test.describe('touch reader', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('opens a nested note with URL punctuation and keeps controls inside the viewport', async ({ page }) => {
    await page.goto(`${lexicon}/index`);
    const toggle = page.getByRole('button', { name: 'Open navigation' });
    await expect(page.getByRole('navigation', { name: 'Test Lexicon navigation' })).toHaveCount(0);
    await toggle.tap();
    const deep = page.getByRole('button', { name: 'deep', exact: true });
    await deep.tap();
    await expect(page.getByRole('button', { name: 'reference', exact: true })).toHaveCount(0);
    await deep.tap();
    await expect(page.getByRole('button', { name: 'reference', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /open page search/i }).tap();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('searchbox').fill('reference 100');
    await dialog.getByRole('link', { name: /100% Ready/ }).tap();
    await expect(page).toHaveURL(`${lexicon}/deep/reference/100%25%20ready%20%231`);
    await expect(page.getByRole('heading', { name: '100% Ready' })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.reload();
    await expect(page.getByRole('heading', { name: '100% Ready' })).toBeVisible();
  });
});

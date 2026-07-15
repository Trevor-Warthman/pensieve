import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

const LEXICON = 'test-lexicon';

test('mobile nav drawer closes after clicking a note link', async ({ page }) => {
  await page.goto(`/${LEXICON}/index`);

  const openButton = page.getByRole('button', { name: 'Open navigation' });
  await openButton.click();

  const noteLink = page.getByRole('link', { name: 'Changelog' });
  await expect(noteLink).toBeVisible();
  await noteLink.click();

  await expect(page).toHaveURL(new RegExp(`/${LEXICON}/changelog$`));
  await expect(page.locator('[aria-hidden="true"].fixed.inset-0')).toHaveCount(0);
});

test('mobile nav drawer closes after selecting a jump-to-page (Cmd+K) result via Enter', async ({ page }) => {
  await page.goto(`/${LEXICON}/index`);

  const openButton = page.getByRole('button', { name: 'Open navigation' });
  await openButton.click();

  await page.getByRole('button', { name: /Open page search/i }).click();

  const input = page.getByPlaceholder('Jump to page…');
  await expect(input).toBeVisible();
  await input.fill('Changelog');
  await input.press('Enter');

  await expect(page).toHaveURL(new RegExp(`/${LEXICON}/changelog$`));
  // Jump-to-page modal itself should be gone.
  await expect(page.getByPlaceholder('Jump to page…')).toHaveCount(0);
  // Mobile drawer backdrop should also be gone — this is the regression:
  // navigate() closed the modal but never closed the drawer.
  await expect(page.locator('[aria-hidden="true"].fixed.inset-0')).toHaveCount(0);
});

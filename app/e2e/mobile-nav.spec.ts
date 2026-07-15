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

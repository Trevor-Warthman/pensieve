import { test, expect } from '@playwright/test';

const LEXICON = 'test-lexicon';

test('tags link is visible in nav and navigates to the tags index', async ({ page }) => {
  await page.goto(`/${LEXICON}/index`);
  const tagsLink = page.getByRole('link', { name: 'Tags' });
  await expect(tagsLink).toBeVisible();
  await tagsLink.click();
  await expect(page).toHaveURL(new RegExp(`/${LEXICON}/tags$`), { timeout: 15000 });
});

test('"clade" folder is hidden from sidebar but still directly reachable', async ({ page }) => {
  await page.goto(`/${LEXICON}/index`);
  await expect(page.getByRole('link', { name: 'Secret Note' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'clade' })).toHaveCount(0);

  const res = await page.goto(`/${LEXICON}/clade/secret`);
  expect(res!.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: 'Secret Note' }).first()).toBeVisible();
});

test('dataview code fence renders as an unsupported-feature callout, not raw code', async ({ page }) => {
  await page.goto(`/${LEXICON}/dataview-demo`);
  await expect(page.getByText('Dataview not supported')).toBeVisible();
  await expect(page.getByText('LIST FROM #guide')).toHaveCount(0);
});

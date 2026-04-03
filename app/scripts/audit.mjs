/**
 * Visual audit — logs in, screenshots key pages, reports what's broken.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3004';
const SHOTS = path.resolve(__dirname, '../audit-shots');
mkdirSync(SHOTS, { recursive: true });

const EMAIL = 'twarthman104@gmail.com';
const PASSWORD = 'Test1234';

function step(msg) { console.log(`\n▶ ${msg}`); }
function ok(msg)   { console.log(`  ✔ ${msg}`); }
function info(msg) { console.log(`  → ${msg}`); }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

// ── Login ─────────────────────────────────────────────────────────────────────
step('Logging in');
await page.goto(`${BASE}/login`);
await page.locator('#email').fill(EMAIL);
await page.locator('#password').fill(PASSWORD);
await page.getByRole('button', { name: /sign in/i }).click();
await page.waitForURL('**/dashboard', { timeout: 10000 });
const token = await page.evaluate(() => localStorage.getItem('pensieve_token'));
ok(`Logged in — token: ${token?.slice(0,30)}…`);
await page.screenshot({ path: `${SHOTS}/01-dashboard.png`, fullPage: true });

// Get first lexicon slug
const lexiconLinks = await page.getByRole('link').filter({ hasText: '/' }).allTextContents();
info(`Lexicon links visible: ${lexiconLinks.join(', ')}`);

// Grab slug from dashboard list
const slugEl = await page.locator('p.text-xs.text-gray-500').first().textContent();
info(`First lexicon meta: ${slugEl}`);
const slug = slugEl?.match(/\/([a-z0-9-]+)/)?.[1];
info(`Using slug: ${slug}`);

if (!slug) {
  console.error('No lexicon found — cannot continue audit');
  await browser.close();
  process.exit(1);
}

// ── Lexicon index ─────────────────────────────────────────────────────────────
step(`Lexicon index: /${slug}`);
await page.goto(`${BASE}/${slug}`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${SHOTS}/02-lexicon-index.png`, fullPage: true });
info(`h1: "${await page.getByRole('heading', { level: 1 }).first().textContent()}"`);
const sidebarItems = await page.locator('nav, aside').allTextContents();
info(`Sidebar/nav text: ${sidebarItems.map(t => t.slice(0,80)).join(' | ')}`);

// ── A note page ───────────────────────────────────────────────────────────────
step(`Note: /${slug}/index`);
await page.goto(`${BASE}/${slug}/index`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${SHOTS}/03-note-index.png`, fullPage: true });
const noteBody = await page.getByRole('article').innerText().catch(() => '(no article tag)');
info(`Article text:\n${noteBody.split('\n').slice(0,20).map(l=>`    ${l}`).join('\n')}`);
const headings = await page.locator('article h1, article h2, article h3').allTextContents();
info(`Headings in article: ${headings.join(', ')}`);
const articleLinks = await page.locator('article a').allTextContents();
info(`Links in article: ${articleLinks.join(', ')}`);

// ── Subfolder note ────────────────────────────────────────────────────────────
step(`Note: /${slug}/areas/engineering`);
await page.goto(`${BASE}/${slug}/areas/engineering`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${SHOTS}/04-note-engineering.png`, fullPage: true });
const engBody = await page.getByRole('article').innerText().catch(() => '(no article)');
info(`Article preview: ${engBody.slice(0, 300)}`);

// ── Search ────────────────────────────────────────────────────────────────────
step('Search');
await page.goto(`${BASE}/${slug}/index`);
await page.waitForLoadState('networkidle');
// Look for search trigger
const searchTrigger = await page.getByRole('button', { name: /search/i }).count() +
                      await page.locator('[placeholder*="search" i], [aria-label*="search" i]').count();
info(`Search UI elements found: ${searchTrigger}`);
await page.screenshot({ path: `${SHOTS}/05-search-ui.png`, fullPage: true });

// ── TOC ───────────────────────────────────────────────────────────────────────
step('Table of contents');
const tocItems = await page.locator('nav[aria-label*="contents" i], [class*="toc"], aside').allTextContents();
info(`TOC/aside content: ${tocItems.join(' | ').slice(0, 200)}`);

// ── Layout measurements ───────────────────────────────────────────────────────
step('Layout measurements');
const mainBox = await page.locator('main').boundingBox().catch(() => null);
const articleBox = await page.locator('article').boundingBox().catch(() => null);
const sidebarBox = await page.locator('aside, nav').first().boundingBox().catch(() => null);
info(`Viewport: 1280×900`);
info(`Main: ${JSON.stringify(mainBox)}`);
info(`Article: ${JSON.stringify(articleBox)}`);
info(`Sidebar/nav: ${JSON.stringify(sidebarBox)}`);

// ── Markdown rendering check ──────────────────────────────────────────────────
step('Markdown element check');
const tables = await page.locator('article table').count();
const codeBlocks = await page.locator('article pre, article code').count();
const h2s = await page.locator('article h2').count();
const h3s = await page.locator('article h3').count();
const uls = await page.locator('article ul').count();
info(`Tables: ${tables}, Code blocks: ${codeBlocks}, H2s: ${h2s}, H3s: ${h3s}, ULs: ${uls}`);

await browser.close();
console.log(`\n✅ Screenshots saved to: ${SHOTS}\n`);

/**
 * Functional test — drives the real browser + CLI to verify the full flow:
 * 1. Register a user via UI
 * 2. Create a lexicon via dashboard UI
 * 3. Sync test-markdown via CLI
 * 4. Verify notes render in the browser
 */
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, '../../cli/dist/index.js');
const NOTES_DIR = '/Users/trevor/Development/test-markdown';
const BASE = 'http://localhost:3000';
const CONF_PATH = path.join(os.homedir(), 'Library', 'Preferences', 'pensieve-nodejs', 'config.json');

const RUN_ID = Date.now().toString(36);
const EMAIL = `claude-ft-${RUN_ID}@pensieve.local`;
const PASSWORD = 'FuncTest123!';
const LEXICON_TITLE = `Claude FT ${RUN_ID}`;
const LEXICON_SLUG = `claude-ft-${RUN_ID}`;

function step(msg) { console.log(`\n▶ ${msg}`); }
function ok(msg)   { console.log(`  ✔ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// ── 1. Register ───────────────────────────────────────────────────────────────
step('Registering user via UI');
await page.goto(`${BASE}/register`);
await page.locator('#email').fill(EMAIL);
await page.locator('#password').fill(PASSWORD);
await page.locator('#confirm').fill(PASSWORD);
await page.getByRole('button', { name: 'Create account' }).click();
await page.waitForURL('**/dashboard', { timeout: 10000 });
ok(`Registered and redirected to dashboard`);

// ── 2. Grab token from localStorage (register sets both localStorage + cookie) ─
const token = await page.evaluate(() => localStorage.getItem('pensieve_token'));
if (!token) fail('No pensieve_token found in localStorage after register');
ok(`Got token: ${token.slice(0, 30)}…`);

// Verify cookie was also set (middleware requires it for /dashboard)
const cookies = await page.context().cookies();
const tokenCookie = cookies.find(c => c.name === 'pensieve_token');
if (!tokenCookie) fail('pensieve_token cookie not set — middleware will block /dashboard');
else ok('pensieve_token cookie set (middleware will allow /dashboard)');

// ── 3. Verify ThemeToggle on dashboard + works ────────────────────────────────
step('Verifying ThemeToggle on dashboard');
{
  const toggleBtn = page.getByRole('button', { name: 'Toggle theme' });
  if (await toggleBtn.count() === 0) fail('ThemeToggle missing from dashboard');
  else {
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await toggleBtn.click();
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (before === after) fail('ThemeToggle click did not change theme');
    else ok(`ThemeToggle works (${before} → ${after})`);
    // toggle back
    await toggleBtn.click();
    await page.waitForTimeout(100);
  }
}

// ── 4. Create lexicon via dashboard UI ───────────────────────────────────────
step('Creating lexicon via dashboard');
await page.getByRole('button', { name: 'New Lexicon' }).first().click();
await page.getByPlaceholder('My Notes').fill(LEXICON_TITLE);
// Slug auto-fills from title — clear and set explicitly
await page.getByPlaceholder('my-notes').clear();
await page.getByPlaceholder('my-notes').fill(LEXICON_SLUG);
await page.getByRole('button', { name: 'Create' }).click();
// Dashboard shows "Sync Your Notes" success view
await page.waitForSelector('text=Lexicon created', { timeout: 5000 });
ok(`Lexicon "${LEXICON_SLUG}" created`);

// ── 4. Seed CLI config with the session token ─────────────────────────────────
step('Writing CLI credentials');
const backup = existsSync(CONF_PATH) ? readFileSync(CONF_PATH, 'utf8') : null;
mkdirSync(path.dirname(CONF_PATH), { recursive: true });
writeFileSync(CONF_PATH, JSON.stringify({ apiEndpoint: `${BASE}/api`, accessToken: token, email: EMAIL }));
ok('CLI config written');

// ── 5. CLI sync ───────────────────────────────────────────────────────────────
step(`Running: pensieve sync ${NOTES_DIR} --lexicon ${LEXICON_SLUG}`);
let syncOut;
try {
  syncOut = execSync(`node ${CLI} sync ${NOTES_DIR} --lexicon ${LEXICON_SLUG}`, { encoding: 'utf8' });
} catch (err) {
  fail(`CLI sync failed: ${err.message}`);
}
console.log(syncOut.trim().split('\n').map(l => `  ${l}`).join('\n'));

const uploadMatch = syncOut.match(/(\d+) uploaded/);
if (!uploadMatch || uploadMatch[1] === '0') fail('Expected files to be uploaded');
ok(`${uploadMatch[1]} files uploaded`);

// ── 6. Verify in browser ──────────────────────────────────────────────────────
step(`Verifying /${LEXICON_SLUG} in browser`);
await page.goto(`${BASE}/${LEXICON_SLUG}`);
await page.waitForLoadState('networkidle');
const h1 = await page.getByRole('heading', { level: 1 }).first().textContent();
ok(`Lexicon index loaded — h1: "${h1}"`);

step(`Verifying /${LEXICON_SLUG}/index note`);
await page.goto(`${BASE}/${LEXICON_SLUG}/index`);
await page.waitForLoadState('networkidle');
const noteH1 = await page.getByRole('heading', { level: 1 }).first().textContent().catch(() => null);
if (!noteH1) fail('No h1 found on note page');
ok(`Note page loaded — h1: "${noteH1}"`);

const articleLinks = await page.getByRole('article').getByRole('link').allTextContents();
ok(`Links in article: ${articleLinks.join(', ') || '(none)'}`);

step(`Verifying subfolder note /${LEXICON_SLUG}/areas/engineering`);
await page.goto(`${BASE}/${LEXICON_SLUG}/areas/engineering`);
await page.waitForLoadState('networkidle');
const subH1 = await page.getByRole('heading', { level: 1 }).first().textContent().catch(() => null);
ok(`Subfolder note — h1: "${subH1}"`);

// ── Restore CLI config ────────────────────────────────────────────────────────
step('Restoring CLI config');
if (backup) { writeFileSync(CONF_PATH, backup); ok('Restored original config'); }
else        { unlinkSync(CONF_PATH); ok('Removed temp config'); }

await browser.close();
console.log('\n✅ All checks passed\n');

/**
 * Self-test: I register, create a lexicon, sync test-markdown, then walk
 * through the rendered site and report exactly what I see on each page.
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

const EMAIL = 'claude@pensieve.local';
const PASSWORD = 'ClaudeTest123!';
const LEXICON_TITLE = 'Claude Test Vault';
const LEXICON_SLUG = 'claude-test-vault';

function step(msg) { console.log(`\n▶ ${msg}`); }
function ok(msg)   { console.log(`  ✔ ${msg}`); }
function info(msg) { console.log(`  → ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// ── Register ──────────────────────────────────────────────────────────────────
step(`Registering as ${EMAIL}`);
await page.goto(`${BASE}/register`);
await page.locator('#email').fill(EMAIL);
await page.locator('#password').fill(PASSWORD);
await page.locator('#confirm').fill(PASSWORD);
await page.getByRole('button', { name: 'Create account' }).click();

// May already exist — check for error
await page.waitForTimeout(1000);
const errorMsg = await page.locator('p.text-red-500').textContent().catch(() => null);
if (errorMsg?.includes('already registered')) {
  ok('Account already exists — logging in instead');
  await page.goto(`${BASE}/login`);
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
} else {
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  ok('Registered and landed on dashboard');
}

const token = await page.evaluate(() => localStorage.getItem('pensieve_token'));
if (!token) fail('No token after login');
ok(`Logged in — token: ${token.slice(0, 30)}…`);

// ── Create lexicon (skip if already exists) ───────────────────────────────────
step(`Creating lexicon "${LEXICON_SLUG}"`);
await page.goto(`${BASE}/dashboard`);
await page.waitForLoadState('networkidle');

const existingLinks = await page.getByRole('link', { name: new RegExp(LEXICON_SLUG) }).count();
if (existingLinks > 0) {
  ok(`Lexicon "${LEXICON_SLUG}" already exists — skipping create`);
} else {
  await page.getByRole('button', { name: 'New Lexicon' }).first().click();
  await page.getByPlaceholder('My Notes').fill(LEXICON_TITLE);
  await page.getByPlaceholder('my-notes').clear();
  await page.getByPlaceholder('my-notes').fill(LEXICON_SLUG);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForSelector('text=Lexicon created', { timeout: 5000 });
  ok(`Lexicon "${LEXICON_SLUG}" created`);
}

// ── Sync via CLI ──────────────────────────────────────────────────────────────
step(`Syncing ${NOTES_DIR}`);
const backup = existsSync(CONF_PATH) ? readFileSync(CONF_PATH, 'utf8') : null;
mkdirSync(path.dirname(CONF_PATH), { recursive: true });
writeFileSync(CONF_PATH, JSON.stringify({ apiEndpoint: `${BASE}/api`, accessToken: token, email: EMAIL }));

const syncOut = execSync(`node ${CLI} sync ${NOTES_DIR} --lexicon ${LEXICON_SLUG}`, { encoding: 'utf8' });
console.log(syncOut.trim().split('\n').map(l => `  ${l}`).join('\n'));

if (backup) writeFileSync(CONF_PATH, backup);
else if (existsSync(CONF_PATH)) unlinkSync(CONF_PATH);

// ── Walk the site and report what I actually see ───────────────────────────────
step(`Visiting /${LEXICON_SLUG} — lexicon index`);
await page.goto(`${BASE}/${LEXICON_SLUG}`);
await page.waitForLoadState('networkidle');
info(`Title: "${await page.title()}"`);
info(`h1: "${await page.getByRole('heading', { level: 1 }).first().textContent()}"`);
const navLinks = await page.getByRole('navigation').getByRole('link').allTextContents().catch(() => []);
info(`Nav links: ${navLinks.join(', ') || '(none found)'}`);
const articleText = await page.getByRole('article').innerText().catch(() => '(no article)');
info(`Article preview: "${articleText.slice(0, 200).replace(/\n/g, ' ')}"`);

step(`Visiting /${LEXICON_SLUG}/index — home note`);
await page.goto(`${BASE}/${LEXICON_SLUG}/index`);
await page.waitForLoadState('networkidle');
info(`h1: "${await page.getByRole('heading', { level: 1 }).first().textContent()}"`);
const noteArticle = await page.getByRole('article').innerText().catch(() => '(no article)');
info(`Full note content:\n${noteArticle.split('\n').map(l => `    ${l}`).join('\n')}`);
const wikilinks = await page.getByRole('article').getByRole('link').allTextContents();
info(`Wikilinks rendered as links: ${wikilinks.join(', ') || '(none)'}`);

step(`Visiting /${LEXICON_SLUG}/areas/engineering — subfolder note`);
await page.goto(`${BASE}/${LEXICON_SLUG}/areas/engineering`);
await page.waitForLoadState('networkidle');
info(`h1: "${await page.getByRole('heading', { level: 1 }).first().textContent()}"`);
const engText = await page.getByRole('article').innerText().catch(() => '(no article)');
info(`Content preview: "${engText.slice(0, 300).replace(/\n/g, ' ')}"`);

step(`Visiting /${LEXICON_SLUG}/projects/pensieve-dev — another note`);
await page.goto(`${BASE}/${LEXICON_SLUG}/projects/pensieve-dev`);
await page.waitForLoadState('networkidle');
info(`h1: "${await page.getByRole('heading', { level: 1 }).first().textContent()}"`);
const projText = await page.getByRole('article').innerText().catch(() => '(no article)');
info(`Content preview: "${projText.slice(0, 300).replace(/\n/g, ' ')}"`);

step('Checking 404 for non-existent note');
await page.goto(`${BASE}/${LEXICON_SLUG}/does-not-exist`);
await page.waitForLoadState('networkidle');
info(`Page text: "${(await page.locator('body').innerText()).slice(0, 100)}"`);

await browser.close();
console.log(`\n✅ Done. Lexicon lives at: ${BASE}/${LEXICON_SLUG}\n`);
console.log(`   User: ${EMAIL} / ${PASSWORD}`);
console.log(`   (persisted in local DynamoDB — survives docker restarts)\n`);

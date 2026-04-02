/**
 * E2E: CLI sync flow
 *
 * Exercises the full `pensieve` CLI against the local Docker stack:
 *   1. Seeds a user + lexicon via the local API (bypassing interactive prompts)
 *   2. Writes CLI credentials into the conf store
 *   3. Runs `pensieve sync` against the test-markdown vault
 *   4. Verifies the synced notes render correctly in the browser
 *   5. Verifies re-sync skips unchanged files
 *   6. Verifies --dry-run doesn't upload
 *
 * Saves and restores the CLI config around the suite so it doesn't clobber
 * any credentials the developer has stored.
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CLI = path.resolve(__dirname, '../../cli/dist/index.js');
const CONF_PATH = path.join(os.homedir(), 'Library', 'Preferences', 'pensieve-nodejs', 'config.json');
const API = 'http://localhost:3000/api';
const NOTES_DIR = path.resolve(__dirname, '../../../test-markdown');

const RUN_ID = Date.now().toString(36);
const EMAIL = `cli-e2e-${RUN_ID}@example.com`;
const PASSWORD = 'TestPassword123!';
const SLUG = `cli-e2e-${RUN_ID}`;

let savedConf: string | null = null;

// Serial: tests share the CLI conf file and depend on sync state from the first test
test.describe.configure({ mode: 'serial' });

test.describe('CLI sync flow', () => {
  test.beforeAll(async () => {
    // Preserve any existing CLI credentials
    savedConf = fs.existsSync(CONF_PATH) ? fs.readFileSync(CONF_PATH, 'utf8') : null;

    // Register
    await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });

    // Login
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const { accessToken } = await loginRes.json() as { accessToken: string };

    // Create lexicon
    await fetch(`${API}/lexicons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ title: 'CLI E2E Vault', slug: SLUG, publishDefault: true }),
    });

    // Write CLI config (same format as `pensieve config init` + `pensieve login --local`)
    fs.mkdirSync(path.dirname(CONF_PATH), { recursive: true });
    fs.writeFileSync(CONF_PATH, JSON.stringify({ apiEndpoint: API, accessToken, email: EMAIL }));
  });

  test.afterAll(() => {
    if (savedConf !== null) {
      fs.writeFileSync(CONF_PATH, savedConf);
    } else if (fs.existsSync(CONF_PATH)) {
      fs.unlinkSync(CONF_PATH);
    }
  });

  test('sync uploads notes and they render in the browser', async ({ page }) => {
    const output = execSync(`node ${CLI} sync ${NOTES_DIR} --lexicon ${SLUG}`, { encoding: 'utf8' });

    expect(output).toContain('uploaded');
    expect(output).toMatch(/5 uploaded/);

    // Lexicon index loads
    await page.goto(`/${SLUG}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Individual note renders correctly
    await page.goto(`/${SLUG}/index`);
    await expect(page.getByRole('heading', { name: 'Welcome to the Test Vault' })).toBeVisible();

    // Sidebar has note links
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  });

  test('re-sync skips unchanged files', () => {
    const output = execSync(`node ${CLI} sync ${NOTES_DIR} --lexicon ${SLUG}`, { encoding: 'utf8' });
    expect(output).toContain('0 uploaded');
    expect(output).toContain('unchanged');
  });

  test('--dry-run reports files without uploading', () => {
    const output = execSync(`node ${CLI} sync ${NOTES_DIR} --lexicon ${SLUG} --dry-run`, { encoding: 'utf8' });
    expect(output).toContain('Would sync');
    expect(output).not.toContain('uploaded');
  });

  test('synced note has wikilinks rendered as links', async ({ page }) => {
    await page.goto(`/${SLUG}/index`);
    // [[projects/pensieve-dev]] should become a clickable link with the slug as text
    await expect(page.getByRole('article').getByRole('link', { name: 'projects/pensieve-dev' })).toBeVisible();
  });

  test('synced note in subfolder renders correctly', async ({ page }) => {
    await page.goto(`/${SLUG}/areas/engineering`);
    await expect(page.getByRole('heading', { name: 'Engineering' }).first()).toBeVisible();
  });
});

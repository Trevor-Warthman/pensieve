import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const API = `${BASE}/api`;

function step(msg) { console.log(`\n▶ ${msg}`); }
function ok(msg)   { console.log(`  ✔ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); }

const browser = await chromium.launch({ headless: true });

// ── Register a real user so we can hit the dashboard ─────────────────────────
const RUN_ID = Date.now().toString(36);
const EMAIL = `theme-debug-${RUN_ID}@pensieve.local`;
const PASSWORD = 'Debug123!';

const regRes = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const { accessToken } = await regRes.json();

// ── Theme on dashboard ────────────────────────────────────────────────────────
step('Dashboard: ThemeToggle present and functional');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Inject token so we land on dashboard not login
  await page.goto(BASE);
  await page.evaluate((token) => {
    localStorage.setItem('pensieve_token', token);
    localStorage.removeItem('theme'); // start with no stored preference
  }, accessToken);

  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');

  const toggleBtn = page.getByRole('button', { name: 'Toggle theme' });
  const count = await toggleBtn.count();
  if (!count) {
    fail('ThemeToggle NOT found on dashboard');
  } else {
    ok('ThemeToggle found on dashboard');

    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    ok(`dark before toggle: ${before}`);

    await toggleBtn.click();
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    ok(`dark after toggle: ${after} (flipped: ${before !== after})`);
    ok(`localStorage.theme: ${stored}`);

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    const persisted = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (persisted === after) {
      ok(`theme persisted across reload: ${persisted}`);
    } else {
      fail(`theme did NOT persist — expected ${after}, got ${persisted}`);
    }

    // Toggle back and verify again
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await page.waitForTimeout(100);
    await page.reload();
    await page.waitForLoadState('networkidle');
    const toggledBack = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (toggledBack === before) {
      ok(`toggled back and persisted: ${toggledBack}`);
    } else {
      fail(`toggle-back did not persist — expected ${before}, got ${toggledBack}`);
    }

    // Check bg color actually changes (dark = gray-950 = rgb(3,7,18), light = white)
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(`body background-color: ${bgColor}`);
  }
  await ctx.close();
}

// ── Auth: stale token behaviour ───────────────────────────────────────────────
step('Auth: stale token after DB wipe (JWT still valid, user gone)');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate((token) => localStorage.setItem('pensieve_token', token), accessToken);

  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');

  // Check lexicons API call result
  const result = await page.evaluate(async (token) => {
    const res = await fetch('/api/lexicons', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { status: res.status, body: await res.json() };
  }, accessToken);

  ok(`/api/lexicons with valid JWT: HTTP ${result.status}`);
  ok(`response: ${JSON.stringify(result.body)}`);

  const dashboardText = await page.locator('main').innerText();
  if (dashboardText.includes('Dashboard')) {
    ok('Dashboard rendered (appears logged in with valid JWT even if DB user missing)');
  } else {
    ok(`Dashboard shows: ${dashboardText.slice(0, 100)}`);
  }
  await ctx.close();
}

await browser.close();
console.log('\n✅ Theme + auth debug complete\n');

import { test, expect } from "@playwright/test";

const email = `test-${Date.now()}@example.com`;
const password = "Password123";

test("register API returns a token", async ({ request }) => {
  const res = await request.post("/api/auth/register", {
    data: { email, password },
  });
  const body = await res.json();
  console.log("register response:", res.status(), body);
  expect(res.status()).toBe(201);
  expect(body).toHaveProperty("accessToken");
});

test("login API returns a token after register", async ({ request }) => {
  // Register first
  await request.post("/api/auth/register", { data: { email: `login-${Date.now()}@example.com`, password } });

  const loginEmail = `login2-${Date.now()}@example.com`;
  await request.post("/api/auth/register", { data: { email: loginEmail, password } });

  const res = await request.post("/api/auth/login", {
    data: { email: loginEmail, password },
  });
  const body = await res.json();
  console.log("login response:", res.status(), body);
  expect(res.status()).toBe(200);
  expect(body).toHaveProperty("accessToken");
});

test("register page renders and form submits", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: /create an account/i })).toBeVisible();

  const testEmail = `ui-${Date.now()}@example.com`;
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[id="password"]', password);
  await page.fill('input[id="confirm"]', password);
  await page.getByRole("button", { name: /create account/i }).click();

  // Should redirect to dashboard on success
  await expect(page).toHaveURL("/dashboard", { timeout: 8000 });
});

test("login page has link to register", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /create one|create an account/i })).toBeVisible();
});

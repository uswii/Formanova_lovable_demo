import { test, expect } from '@playwright/test';

// --- Unauthenticated redirect tests ---

const protectedRoutes = [
  '/studio',
  '/studio/rings',
  '/dashboard',
  '/generations',
  '/credits',
  '/pricing',
  '/payment-success',
  '/cancel',
  '/onboarding',
  '/onboarding-welcome',
  '/studio-cad',
  '/cad-to-catalog',
  '/text-to-cad',
];

for (const route of protectedRoutes) {
  test(`redirects unauthenticated users from ${route} to login`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
  });
}

const adminRoutes = ['/admin/feedback', '/admin/promo-codes'];

for (const route of adminRoutes) {
  test(`blocks unauthenticated users from ${route}`, async ({ page }) => {
    await page.goto(route);
    // AdminRouteGuard shows a 404 page in-place rather than redirecting
    await expect(page.getByText("This page doesn't exist or you don't have access.")).toBeVisible();
  });
}

// --- Public page smoke tests ---

test('home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.locator('body')).toBeVisible();
});

test('login page renders sign-in button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
});

test('login page preserves redirect param', async ({ page }) => {
  await page.goto('/studio?ref=test');
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('ai-jewelry-photoshoot page renders', async ({ page }) => {
  await page.goto('/ai-jewelry-photoshoot');
  await expect(page).toHaveURL('/ai-jewelry-photoshoot');
  await expect(page.locator('body')).toBeVisible();
});

test('ai-jewelry-cad page renders', async ({ page }) => {
  await page.goto('/ai-jewelry-cad');
  await expect(page).toHaveURL('/ai-jewelry-cad');
  await expect(page.locator('body')).toBeVisible();
});

test('unknown route shows 404', async ({ page }) => {
  await page.goto('/this-does-not-exist');
  await expect(page.locator('body')).toBeVisible();
  // Should not redirect to login — it's a public 404
  await expect(page).not.toHaveURL(/\/login/);
});

test('old blog redirect resolves', async ({ page }) => {
  await page.goto('/ai-jewelry-photography-comparison');
  await expect(page).toHaveURL(/\/blog\/ai-jewelry-photography-comparison/);
});

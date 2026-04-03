import { test, expect } from '@playwright/test';

// Unauthenticated users must be redirected to /login
test('redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/studio');
  await expect(page).toHaveURL(/\/login/);
});

test('login page renders sign-in button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
});

test('admin route redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/admin/feedback');
  await expect(page).toHaveURL(/\/login/);
});

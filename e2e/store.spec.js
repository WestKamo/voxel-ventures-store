import { test, expect } from '@playwright/test';
test('customer registers, selects a variant, adds to bag and creates checkout', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Browser Customer');
  await page.getByLabel('Email address').fill('browser-' + Date.now() + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/account/);
  await page.goto('/products/contour-planter');
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('link', { name: 'View bag →' }).click();
  await page.getByRole('link', { name: 'Continue to checkout' }).click();
  await page.getByLabel('Recipient name').fill('Browser Customer');
  await page.getByLabel('Phone number').fill('0712345678');
  await page.getByLabel('Street address').fill('12 Studio Road');
  await page.getByLabel('City', { exact: true }).fill('Durban');
  await page.getByLabel('Province').fill('KZN');
  await page.getByLabel('Postal code').fill('4001');
  await page.getByRole('button', { name: 'Calculate final total' }).click();
  await expect(page.locator('dt').filter({ hasText: /^total$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page).toHaveURL(/orders\//);
  await expect(page.getByRole('heading', { name: 'Awaiting payment confirmation.' })).toBeVisible();
});
test('admin changes seed password and manages an order', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@voxel.test');
  await page.getByLabel('Password', { exact: true }).fill('Initial-admin-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/account\/security/);
  await page.getByLabel('Current password').fill('Initial-admin-password');
  await page.getByLabel('New password (at least 12 characters)').fill('Changed-admin-password');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved successfully' })).toBeVisible();
  await page.goto('/admin/orders');
  const order = page.locator('form').filter({ hasText: 'Admin workflow fixture' });
  await order.getByLabel('Order status').selectOption('Shipped');
  await order.getByLabel('Tracking number').fill('VX-TRACK-001');
  await order.getByRole('button', { name: 'Update order' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved successfully' })).toBeVisible();
  await order.getByRole('link').click();
  await expect(page.getByText('VX-TRACK-001')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shipped', exact: true })).toBeVisible();
});
test('mobile home has no horizontal overflow and navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ideas take shape.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator('.product-card')).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.product-grid').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/mobile-catalogue-viewport.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('.hero h1')).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: 'test-results/home-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'The collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The collection.' })).toBeVisible();
});

test('desktop home renders without script errors', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.hero h1')).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: 'test-results/home-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

test('custom studio previews an STL and submits a text-only idea', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Custom Customer');
  await page.getByLabel('Email address').fill('custom-' + Date.now() + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Custom-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/account/);
  await page.goto('/custom');
  const stl =
    'solid sample\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 10 10\nendloop\nendfacet\nendsolid sample';
  await page.getByLabel('3D model file').setInputFiles({
    name: 'sample.stl',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(stl),
  });
  await expect(page.locator('.viewer canvas')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByLabel('Give your project a name').fill('Custom cable tray');
  await page
    .getByLabel('Describe your idea and intended use')
    .fill('A cable tray for my home office desk.');
  await page.getByRole('button', { name: 'Request a quote' }).click();
  await expect(page).toHaveURL(/requests\//);
  await expect(page.getByRole('heading', { name: 'Custom cable tray' })).toBeVisible();
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
});

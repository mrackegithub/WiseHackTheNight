import { expect, test } from '@playwright/test';

test('the demo user can log in and reach every page', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('demo@sgm.local');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Student!' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const [link, heading] of [
    ['Discover', 'Discover'],
    ['Groups', 'My groups'],
    ['Calendar', 'Calendar'],
    ['Home', 'Welcome, Demo Student!'],
  ]) {
    await nav.getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/Study Group Matcher$/);
  }
});

test('the page never scrolls sideways', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('demo@sgm.local');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Log in' }).click();

  for (const path of ['/discover', '/calendar', '/groups', '/groups/00000000-0000-4000-8005-000000000004']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});

import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '../../../docs/screenshots');

test.use({
  viewport: { width: 1280, height: 850 },
  deviceScaleFactor: 2, // High-DPI for crisp screenshots
});

test('capture live application screenshots', async ({ page }) => {
  // 1. Log in as demo user
  await page.goto('/login');
  await page.getByLabel('Email').fill('demo@sgm.local');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Student!' })).toBeVisible();

  // 2. Discover deck screenshot
  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'Discover', level: 1 })).toBeVisible();
  await expect(page.getByRole('article')).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, 'discover.png'),
    fullPage: false,
  });

  // 3. Like Gréta Kiss to capture Match Modal
  await page.getByRole('button', { name: 'Like' }).click();
  const matchDialog = page.getByRole('dialog', { name: "It's a match!" });
  await expect(matchDialog).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, 'match-modal.png'),
    fullPage: false,
  });

  // Close match dialog by clicking "Keep swiping"
  await page.getByRole('button', { name: 'Keep swiping' }).click();

  // 4. Calendar & schedule screenshot
  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(screenshotsDir, 'calendar.png'),
    fullPage: false,
  });

  // 5. Groups list screenshot
  await page.goto('/groups');
  await expect(page.getByRole('heading', { name: 'My groups', level: 1 })).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, 'groups.png'),
    fullPage: false,
  });

  // 6. Map & Suggested Locations screenshot (scroll down to show places and Leaflet map)
  await page.goto('/groups/00000000-0000-4000-8005-000000000004');
  await expect(page.getByRole('heading', { name: 'DB Thursday crew', level: 1 })).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 480, behavior: 'instant' }));
  await expect(page.getByRole('heading', { name: 'Suggested places' })).toBeVisible();
  // Wait for Leaflet map tiles and rendering
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: path.join(screenshotsDir, 'map-locations.png'),
    fullPage: false,
  });

  // Scroll back to top for opening modal
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(500);

  // 8. Schedule session & Book Room modal screenshot (select bookable room)
  const scheduleBtn = page.getByRole('region', { name: 'Suggested times' }).getByRole('button', { name: /^Schedule / }).first();
  await scheduleBtn.click();
  const dialog = page.getByRole('dialog', { name: 'Schedule a session' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.locator('label', { hasText: 'Bookable' }).first().click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Group room 1')).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(screenshotsDir, 'book-room.png'),
    fullPage: false,
  });
});

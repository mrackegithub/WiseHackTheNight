import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 2 happy path (ARCHITECTURE §6): register → onboarding → Neptun connect → swipe → match →
 * group → schedule a session and book a room. Runs against the MSW mocks by default.
 */

async function register(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill('E2E Student');
  await page.getByLabel('Email').fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('supersecret');
  await page.getByRole('button', { name: 'Create account' }).click();
}

async function onboard(page: Page) {
  // 1. profile
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
  await page.getByLabel('University').fill('ELTE');
  await page.getByLabel('Faculty').fill('Faculty of Informatics');
  await page.getByRole('button', { name: 'Continue' }).click();

  // 2. subjects
  await page.getByLabel('Search by name or Neptun code').fill('Algorithms and Data Structures I');
  await page.getByRole('button', { name: 'Add Algorithms and Data Structures I', exact: true }).click();
  await page.getByText('I can explain').click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 3. interests
  await page.getByRole('button', { name: 'Exam prep' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 4. preferences (defaults)
  await expect(page.getByRole('heading', { name: 'How you like to study' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. location via address search
  await page.getByLabel('Address or landmark').fill('kalvin');
  await page.getByLabel('Address or landmark').press('Enter');
  await page.getByRole('button', { name: /Kálvin tér/ }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText("You're all set! Start finding study partners.")).toBeVisible();
}

async function connectNeptun(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Calendar' }).click();
  const panel = page.getByRole('region', { name: 'Neptun calendar' });
  await expect(panel.getByText('Not connected', { exact: true })).toBeVisible();
  await panel.getByLabel('Calendar link from Neptun').fill('webcal://neptun.example.edu/calendar/e2e.ics');
  await panel.getByRole('button', { name: 'Connect' }).click();
  await expect(panel.getByText('Synced', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Algorithms and Data Structures I \(lecture\)/).first()).toBeAttached();
}

async function matchWith(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Discover' }).click();
  await expect(page.getByLabel('Subject')).toBeVisible();
  for (let i = 0; i < 16; i++) {
    const current = await page.getByRole('article').getByRole('heading', { level: 2 }).textContent();
    if (current === name) break;
    await page.getByRole('button', { name: 'Pass' }).click();
    await expect(page.getByRole('article').getByRole('heading', { level: 2 })).not.toHaveText(current ?? '');
  }
  await expect(page.getByRole('article').getByRole('heading', { level: 2 })).toHaveText(name);
  await page.getByRole('button', { name: 'Like' }).click();
  const dialog = page.getByRole('dialog', { name: "It's a match!" });
  await expect(dialog).toContainText(`You and ${name}`);
  await dialog.getByRole('link', { name: 'Go to group' }).click();
}

async function scheduleWithRoom(page: Page) {
  await expect(page.getByRole('heading', { name: 'Algorithms and Data Structures I study group' })).toBeVisible();
  await page.getByRole('region', { name: 'Suggested times' }).getByRole('button', { name: /^Schedule / }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Schedule a session' });
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.locator('label', { hasText: 'Bookable' }).first().click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByText('Group room 1').click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Group room 1 (will be booked)')).toBeVisible();
  await dialog.getByRole('button', { name: 'Schedule session' }).click();

  await expect(page.getByText(/^Session scheduled for .* in Group room 1\.$/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sessions' }).getByText(/Group room 1 booked/)).toBeVisible();
}

test('register → onboarding → Neptun → swipe → match → book a room', async ({ page }) => {
  await register(page);
  await onboard(page);
  await connectNeptun(page);
  await matchWith(page, 'Anna Kovács');
  await scheduleWithRoom(page);

  // the session now blocks time in the user's calendar
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Groups' }).click();
  await expect(page.getByRole('link', { name: /Algorithms and Data Structures I study group/ })).toContainText('Next:');
});

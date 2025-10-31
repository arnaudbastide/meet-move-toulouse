import { test, expect } from '@playwright/test';

const uniqueSuffix = Date.now();
const vendorEmail = `vendor+${uniqueSuffix}@example.com`;
const userEmail = `user+${uniqueSuffix}@example.com`;
const password = 'Supabase123!';
const eventTitle = `Bootcamp Vertical ${uniqueSuffix}`;

const nextHourISO = () => {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
};

const threeHoursISO = () => {
  const date = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
};

test.describe.configure({ mode: 'serial' });

test.describe('Meet & Move vendor/user flows', () => {
  test('Vendor creates an event with one slot', async ({ page }) => {
    await page.goto('/auth');
    await page.getByTestId('auth-switch-register').click();
    await page.getByTestId('auth-name').fill('Vendor Flow');
    await page.getByTestId('auth-email').fill(vendorEmail);
    await page.getByTestId('auth-password').fill(password);
    await page.getByLabel('Vendor (publie des activités)').check();
    await page.getByTestId('auth-submit').click();
    await expect(page.getByText('Compte créé', { exact: false })).toBeVisible();

    await page.goto('/create');
    await page.getByTestId('create-title').fill(eventTitle);
    await page.getByTestId('create-description').fill('Session exclusive animée par un coach certifié.');
    await page.getByTestId('create-max').fill('12');
    await page.getByTestId('create-address').fill('10 Rue du Test, Toulouse');
    await page.getByTestId('create-lat').fill('43.6047');
    await page.getByTestId('create-lng').fill('1.4442');

    const start = nextHourISO();
    const end = threeHoursISO();
    await page.getByTestId('slot-start-0').fill(start);
    await page.getByTestId('slot-end-0').fill(end);

    await page.getByRole('button', { name: 'Publier' }).click();
    await expect(page.getByText('Événement créé')).toBeVisible();

    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page.getByRole('button', { name: 'Connexion' })).toBeVisible();
  });

  test('User books then cancels the event', async ({ page, request }) => {
    await page.goto('/auth');
    await page.getByTestId('auth-switch-register').click();
    await page.getByTestId('auth-name').fill('User Flow');
    await page.getByTestId('auth-email').fill(userEmail);
    await page.getByTestId('auth-password').fill(password);
    await page.getByLabel('Utilisateur (réserve des activités)').check();
    await page.getByTestId('auth-submit').click();
    await expect(page.getByText('Compte créé', { exact: false })).toBeVisible();

    await page.goto('/');
    await page.getByRole('link', { name: eventTitle }).click();
    await page.getByRole('radio').first().check();
    await page.getByTestId('event-book').click();
    await expect(page.getByText('Réservation confirmée')).toBeVisible();

    await page.goto('/bookings');
    await expect(page.getByText(eventTitle)).toBeVisible();
    const cancelButton = page.locator('[data-testid^="booking-cancel-"]').first();
    await cancelButton.click();
    await expect(page.getByText('Réservation annulée')).toBeVisible();

    if (process.env.STRIPE_WEBHOOK_SECRET) {
      await test.step('Trigger refund webhook', async () => {
        await request.post(process.env.STRIPE_WEBHOOK_TEST_URL ?? 'http://localhost:8787/webhook', {
          headers: { 'stripe-signature': 'test_signature' },
          data: {},
        });
      });
    }
  });
});

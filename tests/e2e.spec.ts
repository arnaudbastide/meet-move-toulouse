import { test, expect } from '@playwright/test';

test.describe('Vendor Flow', () => {
  test('vendor signup → onboarding link open (mock) → create event → slots', async ({ page }) => {
    // Navigate to auth page
    await page.goto('/auth');

    // Switch to sign up mode
    await page.getByText('Need an account? Sign up').click();

    // Fill signup form as vendor
    await page.fill('input[type="email"]', 'vendor@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('input[id="vendor"]');

    // Submit signup
    await page.getByRole('button', { name: /Sign Up/i }).click();

    // Wait for redirect or success message
    await expect(page).toHaveURL(/\/vendor-dashboard|\/\?/, { timeout: 10000 });

    // If redirected to dashboard, check for onboarding section
    if (page.url().includes('vendor-dashboard')) {
      await expect(page.getByText(/Finaliser mon compte Stripe|Onboarding|Stripe Account/i)).toBeVisible();
    }

    // Navigate to create event
    await page.goto('/create');

    // Fill event form
    await page.fill('input[name="title"]', 'Test Event');
    await page.fill('textarea[name="description"]', 'This is a test event');
    
    // Select category if there's a select dropdown
    const categorySelect = page.locator('select').first();
    if (await categorySelect.count() > 0) {
      await categorySelect.selectOption('sport');
    }

    // Fill price (in cents)
    await page.fill('input[type="number"]:near(:text("Prix"))', '1500');
    
    // Fill max places
    const maxPlacesInput = page.locator('input[type="number"]').filter({ hasText: /places/i }).or(page.locator('input[name*="max"]'));
    if (await maxPlacesInput.count() > 0) {
      await maxPlacesInput.first().fill('10');
    }

    // Fill address
    await page.fill('input[name*="address"]', 'Toulouse - Test Location');

    // Fill lat/lng
    await page.fill('input[name="lat"]', '43.6047');
    await page.fill('input[name="lng"]', '1.4442');

    // Add a slot (start and end times)
    const startInput = page.locator('input[type="datetime-local"]').first();
    const endInput = page.locator('input[type="datetime-local"]').last();
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    
    const endTime = new Date(tomorrow);
    endTime.setHours(16, 0, 0, 0);

    // Format as datetime-local value
    const formatDateTimeLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    await startInput.fill(formatDateTimeLocal(tomorrow));
    await endInput.fill(formatDateTimeLocal(endTime));

    // Submit form
    await page.getByRole('button', { name: /Créer|Create/i }).click();

    // Wait for redirect to event page or success
    await expect(page).toHaveURL(/\/event\//, { timeout: 10000 });

    // Verify event page shows the event
    await expect(page.getByText('Test Event')).toBeVisible();
  });
});

test.describe('User Flow', () => {
  test('user signup → browse → start pay → confirm (mock) → sees booking → cancel within window', async ({ page }) => {
    // Enable Stripe test mode
    await page.addInitScript(() => {
      (window as any).__STRIPE_TEST_MODE__ = true;
    });

    // Navigate to auth page
    await page.goto('/auth');

    // Switch to sign up mode
    await page.getByText(/Need an account|Sign up/i).click();

    // Fill signup form as user
    await page.fill('input[type="email"]', 'user@test.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    
    // Select user role (if radio button exists)
    const userRadio = page.locator('input[id="user"]');
    if (await userRadio.count() > 0) {
      await userRadio.click();
    }

    // Submit signup
    await page.getByRole('button', { name: /Sign Up/i }).click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/(bookings|\?)/, { timeout: 10000 });

    // Navigate to home to browse events
    await page.goto('/');

    // Wait for events to load
    await page.waitForSelector('body', { state: 'visible' });

    // Click on first event card (if exists)
    const firstEvent = page.locator('a[href*="/event/"]').first();
    if (await firstEvent.count() > 0) {
      await firstEvent.click();

      // Wait for event detail page
      await expect(page).toHaveURL(/\/event\//, { timeout: 10000 });

      // Click on first available slot button
      const bookButton = page.getByRole('button', { name: /Payer & réserver|Reserve/i }).first();
      if (await bookButton.count() > 0) {
        await bookButton.click();

        // In test mode, payment should be auto-confirmed
        // Wait for payment dialog or success
        await page.waitForTimeout(2000);

        // Should redirect to bookings page
        await expect(page).toHaveURL(/\/bookings/, { timeout: 10000 });

        // Verify booking appears
        await expect(page.getByText(/réservation|booking/i).first()).toBeVisible({ timeout: 5000 });

        // Try to cancel if cancel button exists and slot is >24h away
        const cancelButton = page.getByRole('button', { name: /Annuler|Cancel/i });
        if (await cancelButton.count() > 0) {
          await cancelButton.first().click();
          
          // Wait for toast or confirmation
          await page.waitForTimeout(1000);
          
          // Should see success message
          await expect(page.getByText(/annulée|annulé|cancel/i)).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Meet & Move/);
});

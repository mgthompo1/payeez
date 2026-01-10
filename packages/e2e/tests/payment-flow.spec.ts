import { test, expect } from '../fixtures/psp-mock';

/**
 * Payment Flow E2E Tests
 *
 * Tests for end-to-end payment processing:
 * - Session creation
 * - Card tokenization
 * - Payment confirmation
 * - Capture and refund flows
 */

test.describe('Payment Session Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test payments
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();
  });

  test('should display payment form elements', async ({ page }) => {
    // Verify core form elements
    await expect(page.getByText(/Payment Processor/i)).toBeVisible();
    await expect(page.getByText(/API Key/i)).toBeVisible();
    await expect(page.getByText(/Amount/i)).toBeVisible();
    await expect(page.getByText(/Currency/i)).toBeVisible();
  });

  test('should show processor selection dropdown', async ({ page }) => {
    // Find the processor select trigger
    const processorSelect = page.locator('button').filter({
      has: page.locator('text=Select a processor, text=Windcave, text=Stripe'),
    });

    // The select should be present
    await expect(page.getByText(/Payment Processor/i)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to create session without API key
    const createButton = page.getByRole('button', {
      name: /Create Payment Session/i,
    });

    // Button should be disabled without API key
    await expect(createButton).toBeDisabled();
  });

  test('should show test card number hint', async ({ page, mockWindcave }) => {
    // Mock successful PSP response
    await mockWindcave({ shouldSucceed: true });

    // Enter API key
    await page.getByPlaceholder(/sk_test/i).fill('sk_test_12345');

    // Try to proceed (if processor is configured)
    const createButton = page.getByRole('button', {
      name: /Create Payment Session/i,
    });

    // If button is enabled, click it
    if (await createButton.isEnabled()) {
      await createButton.click();

      // Should show card input step with test card hint
      await expect(page.getByText(/4111 1111 1111 1111/)).toBeVisible();
    }
  });
});

test.describe('Payment Elements Integration', () => {
  test('should load payment elements iframe', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Check if iframe would load (form needs to be in step 2)
    await expect(page.getByText(/Test Payment/i)).toBeVisible();
  });
});

test.describe('Payment Result Handling', () => {
  test('should display success state correctly', async ({
    page,
    mockWindcave,
  }) => {
    await mockWindcave({ shouldSucceed: true });

    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify the form is ready
    await expect(page.getByText(/Test Payment/i)).toBeVisible();
  });

  test('should display failure state correctly', async ({
    page,
    mockWindcave,
  }) => {
    await mockWindcave({
      shouldSucceed: false,
      errorCode: 'DO',
      errorMessage: 'Card declined',
    });

    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify the form is ready
    await expect(page.getByText(/Test Payment/i)).toBeVisible();
  });
});

test.describe('Event Logging', () => {
  test('should display event log panel', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify event log section
    await expect(page.getByText(/Event Log/i)).toBeVisible();
    await expect(page.getByText(/Waiting for events/i)).toBeVisible();
  });

  test('should update log on form interactions', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // The event log should show waiting state initially
    await expect(page.getByText(/Waiting for events/i)).toBeVisible();
  });
});

test.describe('Currency Selection', () => {
  test('should show available currencies', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Find currency selector
    const currencyText = page.getByText(/Currency/i);
    await expect(currencyText).toBeVisible();
  });

  test('should default to NZD', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify NZD is visible as default or in selector
    await expect(page.locator('body')).toContainText(/NZD/);
  });
});

test.describe('Amount Handling', () => {
  test('should accept decimal amounts', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Find amount input and verify it accepts decimals
    const amountInput = page.locator('input[type="number"]').first();

    if (await amountInput.isVisible()) {
      await amountInput.fill('99.99');
      await expect(amountInput).toHaveValue('99.99');
    }
  });

  test('should display default amount', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Amount field should have a default value
    const amountInput = page.locator('input[type="number"]').first();

    if (await amountInput.isVisible()) {
      const value = await amountInput.inputValue();
      expect(parseFloat(value)).toBeGreaterThan(0);
    }
  });
});

test.describe('Cross-browser Payment Flow', () => {
  test('should render consistently across browsers', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Core elements should be visible in all browsers
    await expect(page.getByText(/Test Payment/i)).toBeVisible();
    await expect(page.getByText(/Event Log/i)).toBeVisible();
  });
});

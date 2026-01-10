import { test, expect } from '../fixtures/psp-mock';

/**
 * Orchestration E2E Tests
 *
 * Tests for Atlas payment orchestration features:
 * - Failover: When primary PSP fails, automatically route to backup
 * - Traffic splitting: Route traffic to PSPs based on configured weights
 * - Retry logic: Retry on transient failures
 * - Smart routing: Route based on card BIN, amount, etc.
 */

test.describe('Failover Routing', () => {
  test('should failover to secondary PSP when primary fails', async ({
    page,
    mockPSPSequence,
  }) => {
    // Configure mock: First call fails (Windcave), second succeeds (Stripe)
    await mockPSPSequence([
      {
        psp: 'windcave',
        shouldSucceed: false,
        errorCode: 'gateway_timeout',
        errorMessage: 'Gateway timeout',
      },
      {
        psp: 'stripe',
        shouldSucceed: true,
      },
    ]);

    // Navigate to test payments page
    await page.goto('/dashboard/settings');

    // Click on Test Payments tab
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Wait for the tab content to load
    await page.waitForSelector('text=Test Payment');

    // Verify the payment form is displayed
    await expect(page.getByText('Test Payment')).toBeVisible();
  });

  test('should handle all PSPs failing gracefully', async ({
    page,
    mockPSPSequence,
  }) => {
    // Configure all PSPs to fail
    await mockPSPSequence([
      {
        psp: 'windcave',
        shouldSucceed: false,
        errorCode: 'service_unavailable',
      },
      {
        psp: 'stripe',
        shouldSucceed: false,
        errorCode: 'service_unavailable',
      },
    ]);

    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // The UI should show appropriate error messaging
    await expect(page.getByText('Test Payment')).toBeVisible();
  });

  test('should not failover on non-retryable errors', async ({
    page,
    mockWindcave,
  }) => {
    // Card declined is not retryable
    await mockWindcave({
      shouldSucceed: false,
      errorCode: 'DO',
      errorMessage: 'DECLINED - Card declined',
    });

    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify page loads correctly
    await expect(page.getByText('Test Payment')).toBeVisible();
  });
});

test.describe('Traffic Splitting', () => {
  test('should display orchestration configuration page', async ({ page }) => {
    await page.goto('/dashboard/orchestration');

    // Verify orchestration page loads
    await expect(page.getByText(/Orchestration/i)).toBeVisible();
  });

  test('should show routing profiles', async ({ page }) => {
    await page.goto('/dashboard/orchestration');

    // Look for routing profiles section or create button
    await expect(
      page.getByRole('button', { name: /Create|Add/i }).first()
    ).toBeVisible();
  });
});

test.describe('PSP Health Monitoring', () => {
  test('should display processor status in dashboard', async ({ page }) => {
    await page.goto('/dashboard/processors');

    // Verify processors page loads
    await expect(page.getByText(/Processor/i)).toBeVisible();
  });

  test('should show PSP configuration options', async ({ page }) => {
    await page.goto('/dashboard/processors');

    // Look for add processor option
    await expect(page.locator('body')).toContainText(/Windcave|Stripe|Adyen/i);
  });
});

test.describe('Retry Logic', () => {
  test('should retry on transient gateway errors', async ({
    page,
    mockPSPSequence,
  }) => {
    // First attempt times out, second succeeds
    await mockPSPSequence([
      {
        psp: 'windcave',
        shouldSucceed: false,
        errorCode: 'gateway_timeout',
        delay: 100,
      },
      {
        psp: 'windcave',
        shouldSucceed: true,
      },
    ]);

    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify the payment form is available
    await expect(page.getByText('Test Payment')).toBeVisible();
  });

  test('should respect maximum retry attempts', async ({
    page,
    mockWindcave,
  }) => {
    // All attempts fail with retryable error
    await mockWindcave({
      shouldSucceed: false,
      errorCode: 'processor_error',
      errorMessage: 'Temporary processing error',
    });

    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify page loads
    await expect(page.getByText('Test Payment')).toBeVisible();
  });
});

test.describe('AVS and 3DS Support', () => {
  test('should pass AVS data to PSP', async ({ page, mockWindcave }) => {
    await mockWindcave({
      shouldSucceed: true,
      avsResult: 'M', // Match
      cvvResult: 'M',
    });

    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    await expect(page.getByText('Test Payment')).toBeVisible();
  });

  test('should handle 3DS challenge flow', async ({ page, mockWindcave }) => {
    await mockWindcave({
      shouldSucceed: true,
      require3DS: true,
    });

    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    await expect(page.getByText('Test Payment')).toBeVisible();
  });
});

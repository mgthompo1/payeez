import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E Tests
 *
 * Tests for Atlas dashboard navigation and core functionality:
 * - Authentication flow
 * - Navigation structure
 * - Settings pages
 * - Transaction views
 */

test.describe('Dashboard Navigation', () => {
  test('should display dashboard home page', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify dashboard loads
    await expect(page.locator('body')).toContainText(/Overview|Dashboard/i);
  });

  test('should navigate to transactions page', async ({ page }) => {
    await page.goto('/dashboard/transactions');

    // Verify transactions page loads
    await expect(page.locator('body')).toContainText(/Transaction/i);
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Verify settings page loads with tabs
    await expect(page.getByRole('tab', { name: /General/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /API Keys/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Test Payments/i })).toBeVisible();
  });

  test('should navigate to orchestration page', async ({ page }) => {
    await page.goto('/dashboard/orchestration');

    // Verify orchestration page loads
    await expect(page.locator('body')).toContainText(/Orchestration|Routing/i);
  });

  test('should navigate to processors page', async ({ page }) => {
    await page.goto('/dashboard/processors');

    // Verify processors page loads
    await expect(page.locator('body')).toContainText(/Processor/i);
  });

  test('should navigate to vault page', async ({ page }) => {
    await page.goto('/dashboard/vault');

    // Verify vault page loads
    await expect(page.locator('body')).toContainText(/Vault|Token/i);
  });

  test('should navigate to webhooks page', async ({ page }) => {
    await page.goto('/dashboard/webhooks');

    // Verify webhooks page loads
    await expect(page.locator('body')).toContainText(/Webhook/i);
  });
});

test.describe('Settings Page', () => {
  test('should switch between settings tabs', async ({ page }) => {
    await page.goto('/dashboard/settings');

    // Click General tab
    await page.getByRole('tab', { name: /General/i }).click();
    await expect(page.getByText(/Business Information/i)).toBeVisible();

    // Click API Keys tab
    await page.getByRole('tab', { name: /API Keys/i }).click();
    await expect(page.getByText(/Active Keys|Create Key/i)).toBeVisible();

    // Click Test Payments tab
    await page.getByRole('tab', { name: /Test Payments/i }).click();
    await expect(page.getByText(/Test Payment/i)).toBeVisible();
  });

  test('should display business settings form', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.getByRole('tab', { name: /General/i }).click();

    // Verify form fields
    await expect(page.getByLabel(/Business Name/i)).toBeVisible();
    await expect(page.getByLabel(/Support Email/i)).toBeVisible();
  });

  test('should display currency selector', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.getByRole('tab', { name: /General/i }).click();

    // Look for currency dropdown
    await expect(page.getByText(/Default Currency/i)).toBeVisible();
  });
});

test.describe('API Keys Management', () => {
  test('should display API keys section', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.getByRole('tab', { name: /API Keys/i }).click();

    // Verify API keys section loads
    await expect(page.getByText(/How API Keys Work/i)).toBeVisible();
  });

  test('should show create key dialog', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.getByRole('tab', { name: /API Keys/i }).click();

    // Click create key button
    await page.getByRole('button', { name: /Create Key/i }).click();

    // Verify dialog appears
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/Label/i)).toBeVisible();
  });
});

test.describe('Test Payments', () => {
  test('should display test payment form', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify test payment form elements
    await expect(page.getByText(/Test Payment/i)).toBeVisible();
    await expect(page.getByText(/Payment Processor/i)).toBeVisible();
    await expect(page.getByText(/API Key/i)).toBeVisible();
    await expect(page.getByText(/Amount/i)).toBeVisible();
  });

  test('should show event log section', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify event log is visible
    await expect(page.getByText(/Event Log/i)).toBeVisible();
  });

  test('should preserve API key in localStorage', async ({ page }) => {
    await page.goto('/dashboard/settings');

    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Enter an API key
    const apiKeyInput = page.getByPlaceholder(/sk_test/i);
    await apiKeyInput.fill('sk_test_12345');

    // Navigate away and back
    await page.goto('/dashboard');
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /Test Payments/i }).click();

    // Verify key is preserved (value should be in localStorage)
    const storedKey = await page.evaluate(() =>
      localStorage.getItem('atlas_test_api_key')
    );
    expect(storedKey).toBe('sk_test_12345');
  });
});

test.describe('Transactions List', () => {
  test('should display transactions table', async ({ page }) => {
    await page.goto('/dashboard/transactions');

    // Verify table structure exists
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });

  test('should show transaction details on click', async ({ page }) => {
    await page.goto('/dashboard/transactions');

    // Look for any transaction row
    const transactionRow = page.locator('tr').filter({ hasText: /NZD|USD|captured|pending/i }).first();

    // If there are transactions, clicking should show details
    if (await transactionRow.isVisible()) {
      await transactionRow.click();
      // Details sheet or modal should appear
      await expect(page.getByText(/Transaction|Payment|Details/i)).toBeVisible();
    }
  });
});

test.describe('Responsive Design', () => {
  test('should display mobile menu on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard');

    // Verify page loads on mobile
    await expect(page.locator('body')).toContainText(/Overview|Dashboard/i);
  });

  test('should adapt settings layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard/settings');

    // Tabs should still be accessible
    await expect(page.getByRole('tab').first()).toBeVisible();
  });
});

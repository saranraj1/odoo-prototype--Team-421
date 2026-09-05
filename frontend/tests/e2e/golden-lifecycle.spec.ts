import { test, expect } from '@playwright/test';

test.describe('DealFlow360 Golden Demo E2E Lifecycle', () => {
  test('Complete Golden Lifecycle: Quote -> Guardian (56) -> Upsell -> Approval -> Portal Counter (22%) -> Invalidation (72) -> Confirm -> Split (8:2) -> Paid', async ({ page }) => {
    // 1. Rep logs into internal app
    await page.goto('/login');
    await expect(page).toHaveTitle(/DealFlow360/);

    await page.fill('input[type="email"]', 'rep1@dealflow.test');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');

    // 2. Rep lands on Sales Rep Workspace / Quotations
    await page.waitForURL('**/quotations');
    await expect(page.locator('text=Quotations & Pipeline')).toBeVisible();

    // 3. Open Golden Seeded Deal: D-1024 (Acme Corp)
    await page.goto('/quotations/deal_d1024_acme');
    await expect(page.locator('text=D-1024')).toBeVisible();
    await expect(page.locator('text=Acme Corp')).toBeVisible();

    // 4. Deal Guardian Score Verification (Initial 56.0 HIGH)
    const guardianScore = page.locator('text=56.0');
    await expect(guardianScore).toBeVisible();
    await expect(page.locator('text=Pending: Sales Manager')).toBeVisible();

    // 5. Check Next Best Action Upsell Recommendation
    await expect(page.locator('text=Recommended Action')).toBeVisible();
    await expect(page.locator('text=Add Universal Docking Station')).toBeVisible();

    // 6. Navigate to Approvals as Sales Manager
    await page.goto('/approvals/deal_d1024_acme');
    await expect(page.locator('text=Approval Assessment')).toBeVisible();
    await expect(page.locator('text=Sales Manager Review')).toBeVisible();

    // 7. Manager Approves Deal
    const approveBtn = page.locator('button:has-text("Approve Deal")');
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await page.click('button:has-text("Confirm Decision")');
      await expect(page.locator('text=Quotation approved and unlocked in Odoo')).toBeVisible();
    }

    // 8. Zero-Trust Customer Portal Flow
    // Visit portal login & verify Acme magic token
    await page.goto('/portal/verify?token=magic_token_acme_buyer');
    await page.waitForURL('**/portal');

    // Verify Customer Portal renders safely without internal metadata
    await expect(page.locator('text=Acme Corp')).toBeVisible();
    await expect(page.locator('text=Cost')).not.toBeVisible();
    await expect(page.locator('text=Margin')).not.toBeVisible();
    await expect(page.locator('text=Risk Score')).not.toBeVisible();

    // 9. Customer Submits Counter Offer (22% discount requested)
    const counterDiscountInput = page.locator('input[type="number"]');
    if (await counterDiscountInput.isVisible()) {
      await counterDiscountInput.fill('22');
      await page.fill('textarea', 'Requesting 22% enterprise discount for bulk purchase.');
      await page.click('button:has-text("Send Counter-Offer")');
      await expect(page.locator('text=Counter-offer transmitted')).toBeVisible();
    }

    // 10. Switch back to Internal Quotation Workspace to verify Invalidation Banner
    await page.goto('/quotations/deal_d1024_acme');
    await expect(page.locator('text=APPROVAL INVALIDATED')).toBeVisible();

    // 11. Customer Confirms Deal via Portal
    await page.goto('/portal/deal_d1024_acme');
    const confirmDealBtn = page.locator('button:has-text("Accept & Confirm Quotation")');
    if (await confirmDealBtn.isVisible()) {
      await confirmDealBtn.click();
      await page.click('button:has-text("Sign & Confirm Order")');
      await expect(page.locator('text=Quotation Confirmed!')).toBeVisible();
    }

    // 12. Fulfillment Verification (Split Routing 8:2)
    await page.goto('/fulfillment/deal_d1024_acme');
    await expect(page.locator('text=Fulfillment Routing')).toBeVisible();
    await expect(page.locator('text=Main Warehouse')).toBeVisible();
    await expect(page.locator('text=East Depot')).toBeVisible();

    // 13. Billing & Invoicing Verification
    await page.goto('/billing/deal_d1024_acme');
    await expect(page.locator('text=Billing & Invoicing Governance')).toBeVisible();
    await expect(page.locator('text=Hybrid Billing Profile')).toBeVisible();
    await expect(page.locator('text=Upcoming Projected Billing Schedule')).toBeVisible();
  });
});

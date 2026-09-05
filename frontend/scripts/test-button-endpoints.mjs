import { setupServer } from 'msw/node';
import { handlers } from '../src/mocks/handlers.ts';

const server = setupServer(...handlers);
server.listen({ onUnhandledRequest: 'error' });

async function runTests() {
  console.log('Testing frontend mock API handlers for all button workflows...');
  let passed = 0;
  let failed = 0;

  async function assertReq(name, url, options, validator) {
    try {
      const res = await fetch(`http://localhost:5173${url}`, options);
      if (!res.ok) {
        throw new Error(`Status ${res.status}: ${res.statusText}`);
      }
      let body;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/pdf') || ct.includes('application/octet-stream')) {
        body = await res.blob();
      } else {
        body = await res.json();
      }
      if (validator) validator(body, res);
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. New Quotation: Create & Evaluate
  await assertReq(
    'New Quotation: Create & Evaluate Deal',
    '/api/v1/deals',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner_id: 1,
        lines: [{ product_id: 101, qty: 5, discount_pct: 10 }],
      }),
    },
    (b) => {
      if (!b.data?.deal?.reference) throw new Error('Missing deal reference');
    }
  );

  // 2. Quotation Workspace: Re-evaluate button
  await assertReq(
    'Quotation Workspace: Re-evaluate deal',
    '/api/v1/deals/deal_d1024_acme/evaluate',
    { method: 'POST' },
    (b) => {
      if (!b.data?.risk?.score) throw new Error('Missing risk score');
    }
  );

  // 3. Quotation Workspace: Update order discount
  await assertReq(
    'Quotation Workspace: Update order discount',
    '/api/v1/deals/deal_d1024_acme',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_discount_pct: 5 }),
    },
    (b) => {
      if (b.data?.deal?.order_discount_pct !== 5) throw new Error('Order discount not updated');
    }
  );

  // 4. Lines Table: Add line
  await assertReq(
    'Lines Table: Add new line',
    '/api/v1/deals/deal_d1024_acme/lines',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: 102, qty: 2, discount_pct: 5 }),
    },
    (b) => {
      if (b.data?.quote?.lines?.length < 3) throw new Error('Line not added');
    }
  );

  // 5. Lines Table: Delete line
  await assertReq(
    'Lines Table: Delete line',
    '/api/v1/deals/deal_d1024_acme/lines/3',
    { method: 'DELETE' },
    (b) => {
      if (b.data?.quote?.lines?.find((l) => l.odoo_line_id === 3)) throw new Error('Line not deleted');
    }
  );

  // 6. Recommendation Card: Dismiss button
  await assertReq(
    'Recommendation Card: Dismiss recommendation',
    '/api/v1/deals/deal_d1024_acme/recommendations/rec_docking_station/dismiss',
    { method: 'POST' },
    (b) => {
      if (!b.message) throw new Error('Missing dismiss confirmation');
    }
  );

  // 7. Fulfillment: Accept Suggested Split
  await assertReq(
    'Fulfillment: Accept suggested split',
    '/api/v1/deals/deal_d1024_acme/fulfillment/accept',
    { method: 'POST' },
    (b) => {
      if (b.data?.plan?.status !== 'ACCEPTED') throw new Error('Plan not accepted');
    }
  );

  // 8. Fulfillment: Manual Override
  await assertReq(
    'Fulfillment: Apply manual override',
    '/api/v1/deals/deal_d1024_acme/fulfillment/override',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocations: [{ odoo_sale_order_line_id: 1, odoo_warehouse_id: 1, qty: 10 }], reason: 'Test' }),
    },
    (b) => {
      if (b.data?.plan?.status !== 'OVERRIDDEN') throw new Error('Plan not overridden');
    }
  );

  // 9. Fulfillment: Apply to Odoo
  await assertReq(
    'Fulfillment: Apply to Odoo',
    '/api/v1/deals/deal_d1024_acme/fulfillment/apply',
    { method: 'POST' },
    (b) => {
      if (b.data?.plan?.status !== 'APPLIED') throw new Error('Plan not applied');
    }
  );

  // 10. Fulfillment: Consolidate Backorder
  await assertReq(
    'Fulfillment: Consolidate backorder',
    '/api/v1/deals/deal_d1024_acme/fulfillment/consolidate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouse_id: 1 }),
    }
  );

  // 11. Invoice Detail: Record Payment
  await assertReq(
    'Invoice Detail: Record payment',
    '/api/v1/deals/deal_d1024_acme/billing/invoices/1042/payments',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 558000 }),
    },
    (b) => {
      if (b.data?.status !== 'Paid') throw new Error('Payment not recorded as Paid');
    }
  );

  // 11b. Billing Detail: Cancel Subscription
  await assertReq(
    'Billing Detail: Cancel recurring subscription',
    '/api/v1/deals/deal_d1024_acme/billing/subscriptions/101/cancel',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Customer requested cancellation' }),
    },
    (b) => {
      if (b.data?.status !== 'CANCELLED') throw new Error('Subscription not marked as CANCELLED');
    }
  );


  // 12. Health: Nudge Rep Action
  await assertReq(
    'Health: Act on Alert (Nudge)',
    '/api/v1/alerts/alert_1/actions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'NUDGE', message: 'Please follow up' }),
    }
  );

  // 13. Reports: Export PDF
  await assertReq(
    'Reports: Export PDF report blob',
    '/api/v1/reports/deals?format=pdf',
    { method: 'GET' },
    (b, res) => {
      const ct = res.headers.get('content-type');
      if (!ct || !ct.includes('application/pdf')) throw new Error(`Wrong content-type: ${ct}`);
      if (!b.size || b.size === 0) throw new Error('Empty blob returned');
    }
  );

  // 14. Config: Update Settings
  await assertReq(
    'Config: Save Governance Settings',
    '/api/v1/admin/settings',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_threshold: 25, finance_threshold: 55 }),
    }
  );

  // 15. Negotiation: Respond to Counter-offer (Resolves open request)
  await assertReq(
    'Negotiation: Accept counter-offer and invalidate previous approval',
    '/api/v1/deals/deal_d1024_acme/negotiations/neg_req_counter_22/respond',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'ACCEPT' }),
    },
    (b) => {
      if (b.data?.risk?.score !== 72.0) throw new Error('Risk score not elevated to 72');
      if (b.data?.negotiation?.open_requests?.length !== 0) throw new Error('Open request not removed');
    }
  );

  // 16. Portal: Withdraw Counter-offer
  await assertReq(
    'Portal: Withdraw counter-offer',
    '/api/v1/portal/deals/deal_d1024_acme/negotiations/neg_req_1/withdraw',
    { method: 'POST' }
  );

  server.close();
  console.log(`\nTest results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});

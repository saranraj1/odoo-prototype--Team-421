import { http, HttpResponse } from 'msw';
import { mockState } from './state';

export const handlers = [
  // Auth
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as any;
    const loginLower = (body.login || '').toLowerCase().trim();
    const allUsers = Object.values(mockState.users);

    // Exact or partial email/name match
    let user = allUsers.find(
      (u) =>
        u.email.toLowerCase() === loginLower ||
        u.name.toLowerCase().includes(loginLower)
    );

    if (!user) {
      if (loginLower.includes('admin')) user = mockState.users.admin;
      else if (loginLower.includes('manager') || loginLower.includes('sunita')) user = mockState.users.manager1;
      else if (loginLower.includes('finance') || loginLower.includes('vikram')) user = mockState.users.finance;
      else if (loginLower.includes('buyer') || loginLower.includes('acme') || loginLower.includes('customer')) user = mockState.users.portalAcme;
      else user = mockState.users.rep1;
    }

    return HttpResponse.json({
      data: {
        access_token: `mock_jwt_${user.role.toLowerCase()}_${user.id}`,
        token_type: 'bearer',
        expires_in: 43200,
        user,
      },
    });
  }),

  http.post('*/api/v1/auth/signup', async ({ request }) => {
    const body = (await request.json()) as any;
    const id = Date.now();
    const newCustomer = {
      id,
      odoo_user_id: id,
      partner_id: id,
      name: body.contact_name || body.name || 'New Customer',
      company_name: body.company_name || 'Customer Enterprise',
      email: body.email || `buyer_${id}@example.com`,
      password: body.password || 'Password123!',
      role: 'CUSTOMER' as const,
      company_id: 1,
      is_active: true,
    };

    mockState.saveUser(`customer_${id}`, newCustomer);

    return HttpResponse.json({
      data: {
        access_token: `mock_jwt_customer_${id}`,
        token_type: 'bearer',
        expires_in: 43200,
        user: newCustomer,
        partner: { id, name: newCustomer.company_name },
      },
    });
  }),

  // User Management for Administrator
  http.get('*/api/v1/users', () => {
    return HttpResponse.json({ data: Object.values(mockState.users) });
  }),

  http.post('*/api/v1/users', async ({ request }) => {
    const body = (await request.json()) as any;
    const id = Date.now();
    const newUser = {
      id,
      odoo_user_id: id,
      name: body.name || 'Team Member',
      email: body.email,
      role: body.role || 'SALES_REP',
      password: body.password || 'Password123!',
      team_id: body.team_id || 1,
      company_id: 1,
      company_name: body.company_name || 'DealFlow Enterprise Inc',
      is_active: true,
    };
    mockState.saveUser(`user_${id}`, newUser);
    return HttpResponse.json({ data: newUser });
  }),

  http.patch('*/api/v1/users/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const patch = (await request.json()) as any;
    const key = Object.keys(mockState.users).find((k) => mockState.users[k].id === id);
    if (key) {
      mockState.users[key] = { ...mockState.users[key], ...patch };
      mockState.saveUser(key, mockState.users[key]);
      return HttpResponse.json({ data: mockState.users[key] });
    }
    return HttpResponse.json({ message: 'User updated' });
  }),

  http.delete('*/api/v1/users/:id', ({ params }) => {
    const id = Number(params.id);
    const key = Object.keys(mockState.users).find((k) => mockState.users[k].id === id);
    if (key) {
      mockState.removeUser(key);
    }
    return HttpResponse.json({ message: 'User deleted' });
  }),

  http.post('*/api/v1/portal/auth/login', async ({ request }) => {
    const body = (await request.json()) as any;
    const loginLower = (body.login || '').toLowerCase().trim();
    const customer = Object.values(mockState.users).find(
      (u) => u.role === 'CUSTOMER' && (u.email.toLowerCase() === loginLower || u.name.toLowerCase().includes(loginLower))
    ) || mockState.users.portalAcme;

    return HttpResponse.json({
      data: {
        access_token: `mock_jwt_portal_${customer.id}`,
        token_type: 'bearer',
        expires_in: 14400,
        partner: { id: customer.partner_id || customer.id, name: customer.company_name || customer.name },
      },
    });
  }),

  http.get('*/api/v1/auth/me', () => {
    return HttpResponse.json({ data: mockState.users.rep1 });
  }),

  http.post('*/api/v1/portal/auth/magic-link', () => {
    return HttpResponse.json({ message: 'Magic link dispatched' }, { status: 202 });
  }),

  http.get('*/api/v1/portal/auth/verify', () => {
    return HttpResponse.json({
      data: {
        access_token: 'mock_jwt_portal_acme',
        token_type: 'bearer',
        partner: { id: 1, name: 'Acme Corp' },
      },
    });
  }),

  http.post('*/api/v1/portal/auth/exchange', () => {
    return HttpResponse.json({
      data: {
        access_token: 'mock_jwt_portal_acme',
        token_type: 'bearer',
        partner: { id: 1, name: 'Acme Corp' },
      },
    });
  }),

  http.get('*/api/v1/portal/me', () => {
    return HttpResponse.json({ data: { id: 1, name: 'Acme Corp' } });
  }),

  // Deals
  http.get('*/api/v1/deals', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('pipeline') === 'true') {
      return HttpResponse.json({
        data: {
          columns: [
            { status: 'DRAFT', items: mockState.deals.filter((d) => d.status === 'DRAFT') },
            { status: 'PENDING_APPROVAL', items: mockState.deals.filter((d) => d.status === 'PENDING_APPROVAL') },
            { status: 'APPROVED', items: mockState.deals.filter((d) => d.status === 'APPROVED') },
            { status: 'UNDER_NEGOTIATION', items: mockState.deals.filter((d) => d.status === 'UNDER_NEGOTIATION') },
            { status: 'CONFIRMED', items: mockState.deals.filter((d) => d.status === 'CONFIRMED') },
          ],
        },
      });
    }

    const statusParam = url.searchParams.get('status');
    const q = (url.searchParams.get('q') || '').toLowerCase();
    let items = [...mockState.deals];
    if (statusParam) {
      const allowed = statusParam.split(',').map((s) => s.trim());
      items = items.filter((d) => allowed.includes(d.status) || allowed.includes(d.approval_state));
    }
    if (q) {
      items = items.filter(
        (d) =>
          d.reference.toLowerCase().includes(q) ||
          d.partner_name_cache.toLowerCase().includes(q) ||
          d.odoo_order_name.toLowerCase().includes(q)
      );
    }

    return HttpResponse.json({
      data: {
        items,
        total: items.length,
        page: 1,
        page_size: 20,
      },
    });
  }),

  http.get('*/api/v1/deals/:id/workspace', ({ params }) => {
    const id = String(params.id);
    if (id === 'deal_d1023_beta') {
      const copy = JSON.parse(JSON.stringify(mockState.goldenDeal));
      copy.deal.id = 'deal_d1023_beta';
      copy.deal.reference = 'D-1023';
      copy.deal.odoo_order_name = 'SO-2026-011';
      copy.deal.current_risk_score = 29.7;
      copy.deal.current_severity = 'MEDIUM';
      copy.deal.health_status = 'AT_RISK';
      copy.deal.amount_total_cache = 420000;
      copy.customer.partner_id = 2;
      copy.customer.name = 'Beta Industries';
      copy.customer.tier_code = 'SILVER';
      copy.risk.score = 29.7;
      copy.risk.severity = 'MEDIUM';
      return HttpResponse.json({ data: copy });
    }
    if (id === 'deal_d1021_delta') {
      const copy = JSON.parse(JSON.stringify(mockState.goldenDeal));
      copy.deal.id = 'deal_d1021_delta';
      copy.deal.reference = 'D-1021';
      copy.deal.odoo_order_name = 'SO-2026-009';
      copy.deal.current_risk_score = 44.5;
      copy.deal.current_severity = 'MEDIUM';
      copy.deal.health_status = 'HEALTHY';
      copy.deal.amount_total_cache = 780000;
      copy.deal.approval_state = 'PENDING_FINANCE';
      copy.approval.state = 'PENDING_FINANCE';
      copy.customer.partner_id = 3;
      copy.customer.name = 'Delta Systems Inc';
      copy.customer.tier_code = 'PLATINUM';
      copy.risk.score = 44.5;
      copy.risk.severity = 'MEDIUM';
      return HttpResponse.json({ data: copy });
    }
    return HttpResponse.json({ data: mockState.goldenDeal });
  }),

  // Approvals List & Inbox
  http.get('*/api/v1/approvals', ({ request }) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status')?.toUpperCase();
    const pendingParam = url.searchParams.get('pending');

    let items = [...mockState.approvals];
    if (statusParam && statusParam !== 'ALL') {
      items = items.filter((a) => a.status === statusParam);
    } else if (pendingParam === 'true') {
      items = items.filter((a) => a.status === 'PENDING');
    }

    return HttpResponse.json({ data: items });
  }),

  http.get('*/api/v1/approvals/inbox', () => {
    // Returns pending approvals
    const items = mockState.approvals.filter((a) => a.status === 'PENDING');
    return HttpResponse.json({ data: items });
  }),

  // Patch Line (e.g. Editing Setup Service discount)
  http.patch('*/api/v1/deals/:id/lines/:lineId', async ({ params, request }) => {
    const lineId = Number(params.lineId);
    const body = (await request.json()) as any;
    const line = mockState.goldenDeal.quote.lines.find((l) => l.odoo_line_id === lineId);
    if (line) {
      if (body.discount_pct !== undefined) {
        line.discount_pct = body.discount_pct;
        line.effective_discount_pct = body.discount_pct;
        line.overage_pts = Math.max(0, line.discount_pct - line.ceiling_pct);
      }
      if (body.qty !== undefined) {
        line.qty = body.qty;
      }
    }
    return HttpResponse.json({ data: mockState.goldenDeal });
  }),

  // Add Recommendation (Universal Docking Station)
  http.post('*/api/v1/deals/:id/recommendations/:rid/add', ({ params }) => {
    const rid = String(params.rid);
    const rec = mockState.goldenDeal.recommendations.find((r) => r.id === rid);
    if (rec) {
      rec.status = 'ADDED';
      mockState.goldenDeal.quote.lines.push({
        odoo_line_id: 4,
        product_id: 104,
        product_name: 'Universal Docking Station',
        category_name: 'Accessories',
        product_type: 'STOCKABLE',
        qty: 1,
        price_unit: 15000,
        discount_pct: 0,
        effective_discount_pct: 0,
        ceiling_pct: 10,
        overage_pts: 0,
        unit_cost: 2000,
        net_value: 15000,
        margin: 13000,
        is_recurring: false,
      });
      // Recalculate totals
      mockState.goldenDeal.quote.totals.net += 15000;
      mockState.goldenDeal.quote.totals.total += 17700;
      mockState.goldenDeal.quote.totals.margin_amount += 13000;
      mockState.goldenDeal.quote.totals.margin_pct = 21.1; // margin rises above 20%
    }
    return HttpResponse.json({ data: mockState.goldenDeal });
  }),

  // Approval actions
  http.post('*/api/v1/deals/:id/approval/approve', () => {
    if (mockState.goldenDeal.approval.state === 'PENDING_MANAGER') {
      mockState.goldenDeal.approval.state = 'PENDING_FINANCE';
      mockState.goldenDeal.next_best_action = {
        type: 'FINANCE_APPROVAL_REQUIRED',
        priority: 1,
        title: 'Awaiting Finance Officer Approval',
        explanation: 'Stage 1 approved by Sales Manager. Awaiting Stage 2 Finance sign-off.',
        cta_endpoint: '/approvals/deal_d1024_acme',
      };
    } else if (mockState.goldenDeal.approval.state === 'PENDING_FINANCE') {
      mockState.goldenDeal.approval.state = 'APPROVED';
      mockState.goldenDeal.deal.approval_state = 'APPROVED';
      mockState.goldenDeal.next_best_action = {
        type: 'SEND_TO_CUSTOMER',
        priority: 1,
        title: 'Ready to Send to Customer',
        explanation: 'All internal approval stages completed and quotation unlocked.',
        cta_endpoint: '/quotations/deal_d1024_acme',
      };
    }
    return HttpResponse.json({ data: mockState.goldenDeal });
  }),

  http.post('*/api/v1/deals/:id/send', () => {
    mockState.goldenDeal.deal.status = 'SENT';
    mockState.goldenDeal.next_best_action = {
      type: 'FOLLOW_UP_CUSTOMER',
      priority: 2,
      title: 'Awaiting Customer Response',
      explanation: 'Quotation sent to Acme Buyer on Portal.',
    };
    return HttpResponse.json({ data: mockState.goldenDeal });
  }),

  // Portal negotiation counter-offer
  http.post('*/api/v1/portal/deals/:id/negotiations', async ({ request }) => {
    const body = (await request.json()) as any;
    mockState.goldenDeal.deal.status = 'UNDER_NEGOTIATION';
    mockState.goldenDeal.negotiation.open_requests.push({
      id: 'neg_req_counter_22',
      type: 'COUNTER_DISCOUNT',
      status: 'OPEN',
      line_id: 2,
      line_name: 'Setup Service',
      message: body.message || 'Countering with 22% discount',
      requested_value: body.requested_value || 22,
      created_at: new Date().toISOString(),
    });
    return HttpResponse.json({ data: { message: 'Counter proposal submitted' } });
  }),

  // Rep accepts counter-offer -> INVALIDATION (Risk 56 -> 72)
  http.post('*/api/v1/deals/:id/negotiations/:nid/respond', async ({ request }) => {
    const body = (await request.json()) as any;
    if (body.decision === 'ACCEPT') {
      const line = mockState.goldenDeal.quote.lines.find((l) => l.odoo_line_id === 2);
      if (line) {
        line.discount_pct = 22;
        line.effective_discount_pct = 22;
        line.overage_pts = 12; // 22 - 10 = 12 pt over
      }
      // KILLER MOMENT: Invalidation & Risk jumps to 72
      mockState.goldenDeal.risk.previous_score = 56.0;
      mockState.goldenDeal.risk.score = 72.0;
      mockState.goldenDeal.risk.severity = 'HIGH';
      mockState.goldenDeal.approval.state = 'PENDING_MANAGER';
      mockState.goldenDeal.deal.approval_state = 'PENDING_MANAGER';
      mockState.goldenDeal.deal.current_risk_score = 72.0;

      mockState.goldenDeal.timeline.unshift({
        id: 't_inval',
        event_type: 'APPROVAL_INVALIDATED',
        actor_name: 'Deal Guardian',
        actor_role: 'SYSTEM',
        reason: 'Customer 22% counter exceeded approved thresholds. Re-approval required.',
        created_at: new Date().toISOString(),
        summary: 'Previous approval invalidated — terms worsened',
      });

      mockState.goldenDeal.next_best_action = {
        type: 'REAPPROVAL_REQUIRED',
        priority: 1,
        title: 'Re-Approval Required (Risk 72 HIGH)',
        explanation: 'Terms worsened after counter-offer. Deal locked pending Sales Manager & Finance.',
        cta_endpoint: '/approvals/deal_d1024_acme',
      };
    }
    return HttpResponse.json({ data: mockState.goldenDeal });
  }),

  // Portal Confirm
  http.post('*/api/v1/portal/deals/:id/confirm', () => {
    mockState.goldenDeal.deal.customer_confirmed_pending = true;
    return HttpResponse.json({
      data: {
        status: 'UNDER_REVIEW',
        message: 'Your confirmation is awaiting internal approval.',
      },
    });
  }),

  // Internal Confirm (Once re-approved)
  http.post('*/api/v1/deals/:id/confirm', () => {
    mockState.goldenDeal.deal.status = 'CONFIRMED';
    mockState.goldenDeal.deal.confirmed_at = new Date().toISOString();
    return HttpResponse.json({ data: mockState.goldenDeal });
  }),

  // Portal Deal Detail (strictly whitelisted)
  http.get('*/api/v1/portal/deals/:id', () => {
    const d = mockState.goldenDeal;
    return HttpResponse.json({
      data: {
        id: d.deal.id,
        number: d.deal.reference,
        odoo_order_name: d.deal.odoo_order_name,
        portal_status: d.deal.customer_confirmed_pending
          ? 'UNDER_REVIEW'
          : d.deal.status === 'CONFIRMED'
          ? 'CONFIRMED'
          : 'UNDER_NEGOTIATION',
        currency_code: d.deal.currency_code,
        lines: d.quote.lines.map((l) => ({
          line_id: l.odoo_line_id,
          product_name: l.product_name,
          qty: l.qty,
          price_unit: l.price_unit,
          discount_pct: l.discount_pct,
          net_value: l.net_value,
        })),
        totals: {
          subtotal: d.quote.totals.net,
          tax: d.quote.totals.tax,
          total: d.quote.totals.total,
        },
        my_requests: d.negotiation.open_requests,
        comments: d.negotiation.comments.filter((c) => !c.is_internal),
      },
    });
  }),

  http.get('*/api/v1/portal/deals', () => {
    const d = mockState.goldenDeal;
    return HttpResponse.json({
      data: [
        {
          id: d.deal.id,
          number: d.deal.reference,
          portal_status: 'UNDER_NEGOTIATION',
          total: d.quote.totals.total,
          currency_code: d.deal.currency_code,
          updated_at: new Date().toISOString(),
        },
      ],
    });
  }),

  // Control Tower
  http.get('*/api/v1/dashboard/control-tower', () => {
    return HttpResponse.json({ data: mockState.controlTower });
  }),

  // Alerts
  http.get('*/api/v1/alerts', () => {
    return HttpResponse.json({ data: mockState.alerts });
  }),

  http.post('*/api/v1/alerts/recompute', () => {
    return HttpResponse.json({ message: 'Alerts recomputed successfully' });
  }),

  // Notifications
  http.get('*/api/v1/notifications', () => {
    return HttpResponse.json({ data: mockState.notifications });
  }),

  http.post('*/api/v1/notifications/:id/read', ({ params }) => {
    const notif = mockState.notifications.find((n) => n.id === params.id);
    if (notif) notif.is_read = true;
    return HttpResponse.json({ message: 'Marked read' });
  }),

  http.post('*/api/v1/notifications/read-all', () => {
    mockState.notifications.forEach((n) => (n.is_read = true));
    return HttpResponse.json({ message: 'All marked read' });
  }),

  // Odoo Proxies
  http.get('*/api/v1/odoo/products', () => {
    return HttpResponse.json({ data: mockState.products });
  }),

  http.get('*/api/v1/odoo/products/:id', ({ params }) => {
    const p = mockState.products.find((prod) => prod.id === Number(params.id));
    return HttpResponse.json({ data: p || mockState.products[0] });
  }),

  http.get('*/api/v1/odoo/partners', () => {
    return HttpResponse.json({ data: mockState.partners });
  }),

  http.get('*/api/v1/odoo/warehouses', () => {
    return HttpResponse.json({ data: mockState.warehouses });
  }),

  http.get('*/api/v1/odoo/categories', () => {
    return HttpResponse.json({
      data: [
        { id: 1, name: 'Hardware' },
        { id: 2, name: 'Services' },
        { id: 3, name: 'Subscriptions' },
        { id: 4, name: 'Accessories' },
      ],
    });
  }),

  // Admin Outbox (for demo magic link retrieval)
  http.get('*/api/v1/admin/outbox', () => {
    return HttpResponse.json({ data: mockState.outbox });
  }),

  // Invoices List
  http.get('*/api/v1/odoo/invoices', ({ request }) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status')?.toLowerCase();
    let items = [...mockState.invoices];
    if (statusParam && statusParam !== 'all') {
      items = items.filter((i) => i.status.toLowerCase() === statusParam);
    }
    return HttpResponse.json({ data: items });
  }),

  // Subscriptions List
  http.get('*/api/v1/odoo/subscriptions', ({ request }) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status')?.toUpperCase();
    let items = [...mockState.subscriptions];
    if (statusParam && statusParam !== 'ALL') {
      items = items.filter((s) => s.status.toUpperCase() === statusParam);
    }
    return HttpResponse.json({ data: items });
  }),

  // Fulfillment Exceptions
  http.get('*/api/v1/fulfillment/exceptions', () => {
    return HttpResponse.json({ data: mockState.fulfillmentExceptions });
  }),
];

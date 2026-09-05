import { http, HttpResponse } from 'msw';
import { mockState } from './state';

export const handlers = [
  // Auth
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as any;
    const loginLower = (body.login || '').toLowerCase().trim();
    const password = body.password || '';
    const allUsers = Object.values(mockState.users);

    // Exact email, email prefix, username, aliases, or name match
    const user = allUsers.find((u) => {
      const email = u.email.toLowerCase();
      const emailPrefix = email.split('@')[0];
      const username = (u.username || '').toLowerCase();
      const aliases = (u.aliases || []).map((a: string) => a.toLowerCase());
      const name = u.name.toLowerCase();

      return (
        email === loginLower ||
        emailPrefix === loginLower ||
        username === loginLower ||
        aliases.includes(loginLower) ||
        name === loginLower
      );
    });

    if (!user || user.password !== password) {
      return HttpResponse.json(
        {
          error: {
            code: 'AUTH_FAILED',
            message: 'Invalid email or password. Please check your credentials.',
          },
        },
        { status: 401 }
      );
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
    const password = body.password || '';
    const allUsers = Object.values(mockState.users);

    const user = allUsers.find((u) => {
      const email = u.email.toLowerCase();
      const emailPrefix = email.split('@')[0];
      const username = (u.username || '').toLowerCase();
      const aliases = (u.aliases || []).map((a: string) => a.toLowerCase());
      const name = u.name.toLowerCase();

      return (
        email === loginLower ||
        emailPrefix === loginLower ||
        username === loginLower ||
        aliases.includes(loginLower) ||
        name === loginLower
      );
    });

    if (!user || user.password !== password) {
      return HttpResponse.json(
        {
          error: {
            code: 'AUTH_FAILED',
            message: 'Invalid email or password. Please check your credentials.',
          },
        },
        { status: 401 }
      );
    }

    if (user.role !== 'CUSTOMER') {
      return HttpResponse.json({
        data: {
          access_token: `mock_jwt_${user.role.toLowerCase()}_${user.id}`,
          token_type: 'bearer',
          expires_in: 43200,
          is_internal: true,
          user,
          partner: { id: user.id, name: user.name },
        },
      });
    }

    return HttpResponse.json({
      data: {
        access_token: `mock_jwt_portal_${user.id}`,
        token_type: 'bearer',
        expires_in: 14400,
        is_internal: false,
        user,
        partner: {
          id: user.partner_id || user.odoo_user_id || user.id,
          name: user.company_name || user.name,
        },
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
    const ws = mockState.getOrCreateWorkspace(id);
    return HttpResponse.json({ data: ws });
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
  http.post('*/api/v1/deals/:id/approval/approve', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    const reason = body?.reason || 'Quotation approved';
    const authHeader = (request.headers.get('Authorization') || '').toLowerCase();
    const isFinance = authHeader.includes('finance');
    const isAdmin = authHeader.includes('admin');
    const isRep = authHeader.includes('sales_rep') || authHeader.includes('_rep');

    if (isAdmin) {
      return HttpResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message:
              'Segregation of Duties Violation: System Administrators have read-only audit access and cannot approve commercial deals.',
          },
        },
        { status: 403 }
      );
    }

    if (isRep) {
      return HttpResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message:
              'Segregation of Duties Violation: Sales Representatives cannot approve or sign off quotations.',
          },
        },
        { status: 403 }
      );
    }

    if (ws.approval.state === 'PENDING_MANAGER' && isFinance) {
      return HttpResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Stage 1 must be approved by the Sales Manager before Finance sign-off.',
          },
        },
        { status: 400 }
      );
    }

    if (ws.approval.state === 'PENDING_FINANCE' && !isFinance) {
      return HttpResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Stage 2 requires Finance Officer sign-off.',
          },
        },
        { status: 400 }
      );
    }

    if (!isFinance && ws.approval.state === 'PENDING_MANAGER' && ws.deal.required_level === 'MANAGER_AND_FINANCE') {
      ws.approval.state = 'PENDING_FINANCE';
      ws.deal.approval_state = 'PENDING_FINANCE';
      ws.timeline.unshift({
        id: `t_${Date.now()}`,
        event_type: 'APPROVED_STAGE_1',
        actor_name: 'Sunita Sharma (Sales Manager)',
        actor_role: 'SALES_MANAGER',
        reason,
        created_at: new Date().toISOString(),
        summary: 'Stage 1 Sales Manager approval granted',
      });
      ws.next_best_action = {
        type: 'FINANCE_APPROVAL_REQUIRED',
        priority: 1,
        title: 'Awaiting Finance Officer Approval',
        explanation: 'Stage 1 approved by Sales Manager. Awaiting Stage 2 Finance sign-off.',
        cta_endpoint: `/approvals/${id}`,
      };
      const app = mockState.approvals.find((a) => a.id === id);
      if (app) {
        app.stage = 'Finance';
        app.assigned_to = 'Vikram Finance Officer';
      }
      const d = mockState.deals.find((x) => x.id === id);
      if (d) {
        d.approval_state = 'PENDING_FINANCE';
      }
    } else {
      ws.approval.state = 'APPROVED';
      ws.deal.approval_state = 'APPROVED';
      ws.deal.status = 'DRAFT';
      ws.approval.can_decide = false;
      ws.timeline.unshift({
        id: `t_${Date.now()}`,
        event_type: 'APPROVED',
        actor_name: isFinance ? 'Vikram Mehta (Finance Officer)' : 'Sunita Sharma (Sales Manager)',
        actor_role: isFinance ? 'FINANCE' : 'SALES_MANAGER',
        reason,
        created_at: new Date().toISOString(),
        summary: 'Governance approval granted and Odoo quotation unlocked',
      });
      ws.next_best_action = {
        type: 'SEND_TO_CUSTOMER',
        priority: 1,
        title: 'Ready to Send to Customer',
        explanation: 'All internal approval stages completed and quotation unlocked.',
        cta_endpoint: `/quotations/${id}`,
      };
      const app = mockState.approvals.find((a) => a.id === id);
      if (app) {
        app.status = 'APPROVED';
      }
      const d = mockState.deals.find((x) => x.id === id);
      if (d) {
        d.status = 'APPROVED' as any;
        d.approval_state = 'APPROVED';
      }
      if (mockState.controlTower.kpis.pending_approvals > 0) {
        mockState.controlTower.kpis.pending_approvals -= 1;
      }
    }

    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('*/api/v1/deals/:id/approval/reject', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    const reason = body?.reason || 'Quotation rejected';
    const authHeader = (request.headers.get('Authorization') || '').toLowerCase();
    const isFinance = authHeader.includes('finance');
    const isAdmin = authHeader.includes('admin');
    const isRep = authHeader.includes('sales_rep') || authHeader.includes('_rep');

    if (isAdmin) {
      return HttpResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message:
              'Segregation of Duties Violation: System Administrators cannot reject commercial deals.',
          },
        },
        { status: 403 }
      );
    }

    if (isRep) {
      return HttpResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message:
              'Segregation of Duties Violation: Sales Representatives cannot reject quotations.',
          },
        },
        { status: 403 }
      );
    }

    ws.approval.state = 'REJECTED';
    ws.deal.approval_state = 'REJECTED';
    ws.deal.status = 'CANCELLED';
    ws.approval.can_decide = false;
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'REJECTED',
      actor_name: isFinance ? 'Vikram Mehta (Finance Officer)' : 'Sunita Sharma (Sales Manager)',
      actor_role: isFinance ? 'FINANCE' : 'SALES_MANAGER',
      reason,
      created_at: new Date().toISOString(),
      summary: 'Quotation rejected by governance',
    });
    ws.next_best_action = {
      type: 'REDUCE_DISCOUNT',
      priority: 1,
      title: 'Quotation Rejected',
      explanation: reason,
      cta_endpoint: '/quotations',
    };

    const app = mockState.approvals.find((a) => a.id === id);
    if (app) {
      app.status = 'REJECTED' as any;
    }
    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.status = 'REJECTED' as any;
      d.approval_state = 'REJECTED';
    }
    if (mockState.controlTower.kpis.pending_approvals > 0) {
      mockState.controlTower.kpis.pending_approvals -= 1;
    }

    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('*/api/v1/deals/:id/approval/return', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    const reason = body?.reason || 'Quotation returned for revision';
    const authHeader = (request.headers.get('Authorization') || '').toLowerCase();
    const isFinance = authHeader.includes('finance');
    const isAdmin = authHeader.includes('admin');
    const isRep = authHeader.includes('sales_rep') || authHeader.includes('_rep');

    if (isAdmin) {
      return HttpResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message:
              'Segregation of Duties Violation: System Administrators cannot return commercial deals for revision.',
          },
        },
        { status: 403 }
      );
    }

    if (isRep) {
      return HttpResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message:
              'Segregation of Duties Violation: Sales Representatives cannot return quotations.',
          },
        },
        { status: 403 }
      );
    }

    ws.approval.state = 'RETURNED';
    ws.deal.approval_state = 'RETURNED';
    ws.deal.status = 'DRAFT';
    ws.approval.can_decide = false;
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'RETURNED',
      actor_name: isFinance ? 'Vikram Mehta (Finance Officer)' : 'Sunita Sharma (Sales Manager)',
      actor_role: isFinance ? 'FINANCE' : 'SALES_MANAGER',
      reason,
      created_at: new Date().toISOString(),
      summary: 'Returned to sales representative for revision',
    });
    ws.next_best_action = {
      type: 'RESTORE_MARGIN',
      priority: 1,
      title: 'Quotation Returned for Revision',
      explanation: reason,
      cta_endpoint: `/quotations/${id}`,
    };

    const app = mockState.approvals.find((a) => a.id === id);
    if (app) {
      app.status = 'RETURNED' as any;
    }
    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.status = 'DRAFT';
      d.approval_state = 'RETURNED';
    }
    if (mockState.controlTower.kpis.pending_approvals > 0) {
      mockState.controlTower.kpis.pending_approvals -= 1;
    }

    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('*/api/v1/deals/:id/approval/escalate', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    const reason = body?.reason || 'Escalated to Executive Authority';
    const authHeader = (request.headers.get('Authorization') || '').toLowerCase();
    const isAdmin = authHeader.includes('admin');
    const isRep = authHeader.includes('sales_rep') || authHeader.includes('_rep');

    if (isAdmin) {
      return HttpResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message:
              'Segregation of Duties Violation: System Administrators cannot escalate commercial deals.',
          },
        },
        { status: 403 }
      );
    }

    if (isRep) {
      return HttpResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message:
              'Segregation of Duties Violation: Sales Representatives cannot escalate quotations.',
          },
        },
        { status: 403 }
      );
    }

    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'ESCALATED',
      actor_name: 'Approver',
      actor_role: 'SALES_MANAGER',
      reason,
      created_at: new Date().toISOString(),
      summary: 'Escalated to Executive Review / VP of Sales',
    });
    ws.next_best_action = {
      type: 'AWAITING_APPROVER',
      priority: 1,
      title: 'Escalated to Executive Leadership',
      explanation: reason,
      cta_endpoint: `/approvals/${id}`,
    };

    const app = mockState.approvals.find((a) => a.id === id);
    if (app) {
      app.stage = 'VP / Executive';
      app.assigned_to = 'Executive Review Committee';
    }

    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('*/api/v1/deals/:id/submit', async ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    ws.deal.status = 'DRAFT';
    ws.deal.approval_state = 'PENDING_MANAGER';
    ws.approval.state = 'PENDING_MANAGER';
    ws.approval.can_decide = true;
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'SUBMITTED',
      actor_name: 'Sales Rep One',
      actor_role: 'SALES_REP',
      reason: 'Quotation submitted for governance review',
      created_at: new Date().toISOString(),
      summary: 'Submitted for multi-tier approval',
    });
    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.status = 'PENDING_APPROVAL' as any;
      d.approval_state = 'PENDING_MANAGER';
    }
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('*/api/v1/deals/:id/cancel', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    ws.deal.status = 'CANCELLED';
    ws.deal.approval_state = 'REJECTED';
    ws.approval.state = 'REJECTED';
    ws.approval.can_decide = false;
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'CANCELLED',
      actor_name: 'Sales Rep',
      actor_role: 'SALES_REP',
      reason: body?.reason || 'Quotation cancelled',
      created_at: new Date().toISOString(),
      summary: 'Quotation cancelled',
    });
    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.status = 'CANCELLED';
      d.approval_state = 'REJECTED';
    }
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
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
  http.post('*/api/v1/deals/:id/negotiations/:nid/respond', async ({ params, request }) => {
    const id = String(params.id);
    const nid = String(params.nid);
    const body = (await request.json()) as any;
    const ws = mockState.getOrCreateWorkspace(id);

    // Remove resolved request from open requests
    ws.negotiation.open_requests = ws.negotiation.open_requests.filter(
      (r) => r.id !== nid && r.id !== 'neg_req_counter_22'
    );

    if (body.decision === 'ACCEPT') {
      const line = ws.quote.lines.find((l) => l.odoo_line_id === 2);
      if (line) {
        line.discount_pct = 22;
        line.effective_discount_pct = 22;
        line.overage_pts = 12; // 22 - 10 = 12 pt over
      }
      // Invalidation & Risk jumps to 72
      ws.risk.previous_score = 56.0;
      ws.risk.score = 72.0;
      ws.risk.severity = 'HIGH';
      ws.approval.state = 'PENDING_MANAGER';
      ws.deal.approval_state = 'PENDING_MANAGER';
      ws.deal.current_risk_score = 72.0;

      ws.timeline.unshift({
        id: `t_${Date.now()}`,
        event_type: 'APPROVAL_INVALIDATED',
        actor_name: 'Deal Guardian',
        actor_role: 'SYSTEM',
        reason: 'Customer 22% counter exceeded approved thresholds. Re-approval required.',
        created_at: new Date().toISOString(),
        summary: 'Previous approval invalidated — terms worsened',
      });

      ws.next_best_action = {
        type: 'REAPPROVAL_REQUIRED',
        priority: 1,
        title: 'Re-Approval Required (Risk 72 HIGH)',
        explanation: 'Terms worsened after counter-offer. Deal locked pending Sales Manager & Finance.',
        cta_endpoint: `/approvals/${id}`,
      };
    } else {
      ws.timeline.unshift({
        id: `t_${Date.now()}`,
        event_type: 'RETURNED',
        actor_name: 'Sales Rep',
        actor_role: 'SALES_REP',
        reason: body.message || 'Counter-proposal declined by sales rep.',
        created_at: new Date().toISOString(),
        summary: 'Customer counter-offer declined',
      });
    }

    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
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
  http.post('*/api/v1/deals/:id/confirm', ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    ws.deal.status = 'CONFIRMED';
    ws.deal.confirmed_at = new Date().toISOString();
    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.status = 'CONFIRMED';
    }
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
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

  // Deals Management (Creation, Re-evaluation, Patching, Lines)
  http.post('*/api/v1/deals', async ({ request }) => {
    const body = (await request.json()) as any;
    const partnerId = Number(body.partner_id) || 1;
    const partner = mockState.partners.find((p) => p.id === partnerId) || mockState.partners[0];
    const timestamp = Date.now();
    const newId = `deal_d${timestamp}`;
    const refNum = Math.floor(1000 + Math.random() * 9000);
    const reference = `D-${refNum}`;

    const lines = (body.lines || []).map((l: any, idx: number) => {
      const prod = mockState.products.find((p) => p.id === Number(l.product_id)) || mockState.products[0];
      const qty = Number(l.qty) || 1;
      const discount_pct = Number(l.discount_pct) || 0;
      const price_unit = prod.list_price || 10000;
      const unit_cost = (prod as any).standard_price || 5000;
      const net_value = Math.round(price_unit * qty * (1 - discount_pct / 100));
      const margin = net_value - unit_cost * qty;
      const ceiling_pct = prod.category_id === 2 ? 10 : 15;
      return {
        odoo_line_id: idx + 1,
        product_id: prod.id,
        product_name: prod.name,
        category_name: prod.category_name,
        product_type: prod.type || 'STOCKABLE',
        qty,
        price_unit,
        discount_pct,
        effective_discount_pct: discount_pct,
        ceiling_pct,
        overage_pts: Math.max(0, discount_pct - ceiling_pct),
        unit_cost,
        net_value,
        margin,
        is_recurring: prod.category_id === 3,
      };
    });

    const newWs = JSON.parse(JSON.stringify(mockState.goldenDeal));
    newWs.deal.id = newId;
    newWs.deal.reference = reference;
    newWs.deal.odoo_order_name = `SO-2026-${refNum}`;
    newWs.deal.partner_id = partner.id;
    newWs.deal.partner_name_cache = partner.name;
    newWs.deal.status = 'DRAFT';
    newWs.deal.approval_state = 'NOT_EVALUATED';
    newWs.deal.currency_code = body.currency || 'INR';
    newWs.customer.partner_id = partner.id;
    newWs.customer.name = partner.name;
    newWs.customer.tier_code = partner.tier_code || 'STANDARD';
    newWs.quote.lines = lines;
    recalculateQuoteTotals(newWs.quote);

    newWs.deal.amount_total_cache = newWs.quote.totals.total;
    const avgDiscount = lines.length > 0 ? lines.reduce((acc: number, l: any) => acc + l.discount_pct, 0) / lines.length : 0;
    newWs.risk.score = Math.round(avgDiscount * 2.2 + 10);
    newWs.risk.severity = newWs.risk.score > 50 ? 'HIGH' : newWs.risk.score > 25 ? 'MEDIUM' : 'LOW';
    newWs.deal.current_risk_score = newWs.risk.score;
    newWs.deal.current_severity = newWs.risk.severity;
    newWs.deal.required_level = newWs.risk.score > 50 ? 'MANAGER_AND_FINANCE' : newWs.risk.score > 25 ? 'MANAGER_ONLY' : 'REP_ONLY';

    newWs.timeline = [
      {
        id: `t_${timestamp}`,
        event_type: 'CREATED',
        actor_name: 'Sales Rep One',
        actor_role: 'SALES_REP',
        reason: 'Quotation initiated from DealFlow360 workspace',
        created_at: new Date().toISOString(),
        summary: `Created quotation ${reference} for ${partner.name}`,
      },
    ];

    mockState.workspaces[newId] = newWs;
    mockState.deals.unshift({
      id: newId,
      reference,
      odoo_order_name: newWs.deal.odoo_order_name,
      partner_name_cache: partner.name,
      partner_id: partner.id,
      status: 'DRAFT',
      approval_state: 'NOT_EVALUATED',
      required_level: newWs.deal.required_level,
      health_status: 'HEALTHY',
      current_risk_score: newWs.risk.score,
      current_severity: newWs.risk.severity,
      currency_code: newWs.deal.currency_code,
      amount_total_cache: newWs.deal.amount_total_cache,
      last_activity_at: new Date().toISOString(),
      owner: { id: 4, name: 'Sales Rep One' },
      version: 1,
    });

    return HttpResponse.json({ data: newWs, id: newId });
  }),

  http.post('*/api/v1/deals/from-odoo', () => {
    return HttpResponse.json({ data: mockState.goldenDeal });
  }),

  http.post('*/api/v1/deals/:id/evaluate', ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    recalculateQuoteTotals(ws.quote);
    ws.deal.amount_total_cache = ws.quote.totals.total;
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'EVALUATED',
      actor_name: 'Deal Guardian',
      actor_role: 'SYSTEM',
      reason: 'Rule engine completed real-time governance re-evaluation.',
      created_at: new Date().toISOString(),
      summary: `Score refreshed at ${ws.risk.score} (${ws.risk.severity})`,
    });
    return HttpResponse.json({ data: ws });
  }),

  http.patch('*/api/v1/deals/:id', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json()) as any;
    const ws = mockState.getOrCreateWorkspace(id);

    if (body.order_discount_pct !== undefined) {
      ws.deal.order_discount_pct = Number(body.order_discount_pct);
      for (const line of ws.quote.lines) {
        line.effective_discount_pct = line.discount_pct + ws.deal.order_discount_pct;
        line.overage_pts = Math.max(0, line.effective_discount_pct - line.ceiling_pct);
      }
      recalculateQuoteTotals(ws.quote);
      ws.deal.amount_total_cache = ws.quote.totals.total;
    }
    if (body.status) {
      ws.deal.status = body.status;
    }
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('*/api/v1/deals/:id/lines', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json()) as any;
    const ws = mockState.getOrCreateWorkspace(id);

    const prod = mockState.products.find((p) => p.id === Number(body.product_id)) || mockState.products[0];
    const qty = Number(body.qty) || 1;
    const discount_pct = Number(body.discount_pct) || 0;
    const price_unit = prod.list_price || 10000;
    const unit_cost = (prod as any).standard_price || 5000;
    const net_value = Math.round(price_unit * qty * (1 - discount_pct / 100));
    const margin = net_value - unit_cost * qty;
    const ceiling_pct = prod.category_id === 2 ? 10 : 15;
    const lineId = ws.quote.lines.length + 1;

    ws.quote.lines.push({
      odoo_line_id: lineId,
      product_id: prod.id,
      product_name: prod.name,
      category_name: prod.category_name,
      product_type: prod.type || 'STOCKABLE',
      qty,
      price_unit,
      discount_pct,
      effective_discount_pct: discount_pct,
      ceiling_pct,
      overage_pts: Math.max(0, discount_pct - ceiling_pct),
      unit_cost,
      net_value,
      margin,
      is_recurring: prod.category_id === 3,
    });

    recalculateQuoteTotals(ws.quote);
    ws.deal.amount_total_cache = ws.quote.totals.total;

    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.delete('*/api/v1/deals/:id/lines/:lineId', ({ params }) => {
    const id = String(params.id);
    const lineId = Number(params.lineId);
    const ws = mockState.getOrCreateWorkspace(id);

    ws.quote.lines = ws.quote.lines.filter((l) => l.odoo_line_id !== lineId);
    recalculateQuoteTotals(ws.quote);
    ws.deal.amount_total_cache = ws.quote.totals.total;

    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  // Recommendations
  http.get('*/api/v1/deals/:id/recommendations', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.recommendations || [] });
  }),

  http.post('*/api/v1/deals/:id/recommendations/:rid/dismiss', ({ params }) => {
    const id = String(params.id);
    const rid = String(params.rid);
    const ws = mockState.getOrCreateWorkspace(id);
    ws.recommendations = ws.recommendations.filter((r) => r.id !== rid);
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ message: 'Recommendation dismissed' });
  }),

  // Timelines & Comments
  http.get('*/api/v1/deals/:id/timeline', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.timeline || [] });
  }),

  http.get('*/api/v1/deals/:id/assessments/:aid', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.risk });
  }),

  http.get('*/api/v1/deals/:id/negotiations', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.negotiation.open_requests || [] });
  }),

  http.get('*/api/v1/deals/:id/comments', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.negotiation.comments || [] });
  }),

  http.post('*/api/v1/deals/:id/comments', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json()) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    const comment = {
      id: `c_${Date.now()}`,
      author_name: 'Sales Rep One',
      author_role: 'SALES_REP',
      body: body.body || '',
      created_at: new Date().toISOString(),
      is_internal: body.is_internal !== false,
    };
    ws.negotiation.comments.push(comment);
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: comment });
  }),

  // Fulfillment Operations
  http.get('*/api/v1/deals/:id/fulfillment', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.fulfillment });
  }),

  http.post('*/api/v1/deals/:id/fulfillment/propose', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.fulfillment });
  }),

  http.post('*/api/v1/deals/:id/fulfillment/accept', ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    if (ws.fulfillment?.plan) {
      ws.fulfillment.plan.status = 'ACCEPTED';
      ws.fulfillment.plan.strategy = 'MIN_SHIPMENTS';
      // Reset to recommended optimal split (8 units Main Warehouse, 2 units East Depot)
      ws.fulfillment.plan.lines = [
        {
          odoo_sale_order_line_id: 1,
          product_name: 'Laptop Pro 14"',
          odoo_warehouse_id: 1,
          warehouse_name: 'Main Warehouse',
          requested_qty: 10,
          allocated_qty: 8,
          backorder_qty: 0,
          shipping_cost: 15.0,
        },
        {
          odoo_sale_order_line_id: 1,
          product_name: 'Laptop Pro 14"',
          odoo_warehouse_id: 2,
          warehouse_name: 'East Depot',
          requested_qty: 10,
          allocated_qty: 2,
          backorder_qty: 0,
          shipping_cost: 10.0,
        },
      ];
    }
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'FULFILLMENT_ACCEPTED',
      actor_name: 'Fulfillment Coordinator',
      actor_role: 'OPERATIONS',
      reason: 'Algorithmic multi-warehouse split accepted',
      created_at: new Date().toISOString(),
      summary: 'Warehouse split plan accepted',
    });
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws.fulfillment });
  }),

  http.post('*/api/v1/deals/:id/fulfillment/override', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json()) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    if (ws.fulfillment?.plan && Array.isArray(body.allocations)) {
      ws.fulfillment.plan.status = 'OVERRIDDEN';
      ws.fulfillment.plan.strategy = 'MANUAL_OVERRIDE';
      (ws.fulfillment.plan as any).override_reason = body.reason || 'Manual allocation override';

      const warehouseNames: Record<number, string> = {
        1: 'Main Warehouse',
        2: 'East Depot',
        3: 'West Hub',
      };

      const updatedLines = body.allocations
        .map((a: any) => {
          const whId = Number(a.odoo_warehouse_id);
          const whName = a.warehouse_name || warehouseNames[whId] || `Warehouse ${whId}`;
          const allocatedQty = Number(a.qty) || 0;
          return {
            odoo_sale_order_line_id: a.odoo_sale_order_line_id || 1,
            product_name: 'Laptop Pro 14"',
            odoo_warehouse_id: whId,
            warehouse_name: whName,
            requested_qty: 10,
            allocated_qty: allocatedQty,
            backorder_qty: 0,
            shipping_cost: whId === 1 ? 15.0 : whId === 2 ? 10.0 : 20.0,
          };
        })
        .filter((l: any) => l.allocated_qty > 0);

      if (updatedLines.length > 0) {
        ws.fulfillment.plan.lines = updatedLines;
      }
    }
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'FULFILLMENT_OVERRIDDEN',
      actor_name: 'Fulfillment Coordinator',
      actor_role: 'OPERATIONS',
      reason: body.reason || 'Manual warehouse allocation override applied',
      created_at: new Date().toISOString(),
      summary: 'Manual split override applied',
    });
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws.fulfillment });
  }),

  http.post('*/api/v1/deals/:id/fulfillment/apply', ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    if (ws.fulfillment?.plan) {
      ws.fulfillment.plan.status = 'APPLIED';
    }
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'FULFILLMENT_APPLIED',
      actor_name: 'Deal Guardian',
      actor_role: 'SYSTEM',
      reason: 'Allocations written to Odoo stock.picking records',
      created_at: new Date().toISOString(),
      summary: 'Pickings generated in Odoo',
    });
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws.fulfillment });
  }),

  http.post('*/api/v1/deals/:id/fulfillment/consolidate', ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'FULFILLMENT_CONSOLIDATED',
      actor_name: 'Operations Manager',
      actor_role: 'OPERATIONS',
      reason: 'Backorder consolidated into primary warehouse run',
      created_at: new Date().toISOString(),
      summary: 'Backorder consolidated successfully',
    });
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws.fulfillment });
  }),

  // Billing & Payments
  http.get('*/api/v1/deals/:id/billing', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.billing });
  }),

  http.post('*/api/v1/deals/:id/billing/invoices/:invId/payments', ({ params }) => {
    const invId = Number(params.invId);
    const inv = mockState.invoices.find((i) => i.id === invId);
    if (inv) {
      inv.status = 'Paid';
    }
    return HttpResponse.json({
      data: {
        status: 'Paid',
        invoice_id: invId,
        message: 'Payment registered in Odoo general ledger successfully',
      },
    });
  }),

  http.post('*/api/v1/deals/:id/billing/subscriptions/:subId/cancel', async ({ params, request }) => {
    const dealId = String(params.id);
    const subId = Number(params.subId);
    const body = (await request.json().catch(() => ({}))) as any;
    const ws = mockState.getOrCreateWorkspace(dealId);

    // Update workspace subscriptions
    if (ws.billing?.subscriptions) {
      const sub = ws.billing.subscriptions.find((s) => s.id === subId) || ws.billing.subscriptions[0];
      if (sub) {
        sub.status = 'CANCELLED';
        if (Array.isArray(sub.schedule)) {
          sub.schedule.forEach((item) => {
            item.status = 'CANCELLED';
          });
        }
      }
    }

    // Update global odoo subscriptions database
    const odooSub = mockState.subscriptions.find((s) => s.id === subId || s.deal_id === dealId);
    if (odooSub) {
      odooSub.status = 'Cancelled';
    }

    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'SUBSCRIPTION_CANCELLED',
      actor_name: 'Billing Administrator',
      actor_role: 'FINANCE',
      reason: body.reason || 'Recurring subscription cancelled by user request',
      created_at: new Date().toISOString(),
      summary: `Subscription #${subId} cancelled in Odoo database`,
    });

    if (dealId === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }

    return HttpResponse.json({
      data: {
        subscription_id: subId,
        status: 'CANCELLED',
        billing: ws.billing,
        message: 'Subscription cancelled successfully and updated in database',
      },
    });
  }),

  http.post('*/api/v1/odoo/subscriptions/:subId/cancel', async ({ params, request }) => {
    const subId = Number(params.subId);
    const body = (await request.json().catch(() => ({}))) as any;
    const odooSub = mockState.subscriptions.find((s) => s.id === subId);
    if (odooSub) {
      odooSub.status = 'Cancelled';
      if (odooSub.deal_id && mockState.workspaces[odooSub.deal_id]) {
        const ws = mockState.workspaces[odooSub.deal_id];
        if (ws.billing?.subscriptions) {
          const s = ws.billing.subscriptions.find((x) => x.id === subId);
          if (s) {
            s.status = 'CANCELLED';
            s.schedule?.forEach((item) => {
              item.status = 'CANCELLED';
            });
          }
        }
      }
    }
    return HttpResponse.json({
      data: {
        subscription_id: subId,
        status: 'Cancelled',
        message: 'Subscription cancelled successfully in Odoo database',
      },
    });
  }),


  // Alerts Actions
  http.post('*/api/v1/alerts/:id/actions', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as any;
    const alert = mockState.alerts.find((a) => a.id === id);
    if (alert) {
      alert.status = 'ACKNOWLEDGED';
    }
    const qItem = mockState.controlTower.action_queue.find((q) => q.id === id);
    if (qItem) {
      qItem.title += ` [${body.action}]`;
    }
    return HttpResponse.json({ message: `Alert action ${body.action || 'ACTION'} applied successfully` });
  }),

  http.post('*/api/v1/alerts/:id/acknowledge', ({ params }) => {
    const alert = mockState.alerts.find((a) => a.id === params.id);
    if (alert) alert.status = 'ACKNOWLEDGED';
    return HttpResponse.json({ message: 'Alert acknowledged' });
  }),

  http.post('*/api/v1/alerts/:id/resolve', ({ params }) => {
    mockState.alerts = mockState.alerts.filter((a) => a.id !== params.id);
    return HttpResponse.json({ message: 'Alert resolved' });
  }),

  http.get('*/api/v1/reports/:type', ({ request, params }) => {
    const url = new URL(request.url);
    const format = url.searchParams.get('format')?.toLowerCase();
    if (format) {
      const isPdf = format === 'pdf';
      const mime = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blobContent = isPdf
        ? `%PDF-1.4 DealFlow360 Executive Report: ${params.type}`
        : `DealFlow360 Spreadsheet Export: ${params.type}`;
      return new HttpResponse(new Blob([blobContent], { type: mime }), {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename=dealflow_${params.type}_report.${format}`,
        },
      });
    }

    if (params.type === 'summary') {
      return HttpResponse.json({
        data: {
          quotes_created: 18,
          avg_approval_hours: 6.4,
          upsell_revenue: 98000,
          at_risk_count: 2,
          pipeline_value: 1850000,
        },
      });
    }
    if (params.type === 'deals') {
      return HttpResponse.json({ data: mockState.deals });
    }
    if (params.type === 'approvals') {
      return HttpResponse.json({ data: mockState.approvals });
    }
    if (params.type === 'risk') {
      return HttpResponse.json({
        data: {
          distribution: [
            { range: '0-20 (LOW)', count: 6 },
            { range: '21-50 (MEDIUM)', count: 8 },
            { range: '51-100 (HIGH)', count: 4 },
          ],
        },
      });
    }
    return HttpResponse.json({ data: [] });
  }),

  // Admin Settings & Governance Configuration
  http.get('*/api/v1/admin/settings', () => {
    return HttpResponse.json({
      data: {
        manager_threshold: 20,
        finance_threshold: 50,
        single_line_finance_pts: 8,
      },
    });
  }),

  http.put('*/api/v1/admin/settings', () => {
    return HttpResponse.json({ message: 'Platform settings saved successfully' });
  }),

  http.get('*/api/v1/tiers', () => {
    return HttpResponse.json({
      data: [
        { code: 'GOLD', name: 'Gold Tier', min_spend: 1000000, discount_cap: 25 },
        { code: 'SILVER', name: 'Silver Tier', min_spend: 500000, discount_cap: 18 },
        { code: 'BRONZE', name: 'Bronze Tier', min_spend: 0, discount_cap: 10 },
      ],
    });
  }),

  http.post('*/api/v1/tiers', () => {
    return HttpResponse.json({ message: 'Tier saved successfully' });
  }),

  http.get('*/api/v1/policies', () => {
    return HttpResponse.json({
      data: [
        { id: 'pol_1', name: 'Standard Margin Floor (15%)', threshold: 15, active: true },
        { id: 'pol_2', name: 'Executive Approval on Over-Discount', threshold: 20, active: true },
      ],
    });
  }),

  http.post('*/api/v1/policies', () => {
    return HttpResponse.json({ message: 'Policy saved successfully' });
  }),

  http.post('*/api/v1/policies/simulate', () => {
    return HttpResponse.json({
      data: {
        simulated_risk: 28.5,
        required_level: 'MANAGER_ONLY',
        passed: true,
      },
    });
  }),

  http.get('*/api/v1/warehouse-profiles', () => {
    return HttpResponse.json({ data: mockState.warehouses });
  }),

  http.post('*/api/v1/warehouse-profiles', () => {
    return HttpResponse.json({ message: 'Warehouse profile saved successfully' });
  }),

  http.get('*/api/v1/recommendation-rules', () => {
    return HttpResponse.json({
      data: [
        { id: 'rule_1', name: 'Laptop Docking Station Cross-Sell', confidence: 0.85, active: true },
        { id: 'rule_2', name: 'Extended Warranty Upsell', confidence: 0.72, active: true },
      ],
    });
  }),

  http.post('*/api/v1/recommendation-rules/mine', () => {
    return HttpResponse.json({ mined_count: 3 });
  }),

  http.get('*/api/v1/admin/users', () => {
    return HttpResponse.json({ data: Object.values(mockState.users) });
  }),

  http.get('*/api/v1/admin/odoo/health', () => {
    return HttpResponse.json({
      data: {
        status: 'HEALTHY',
        latency_ms: 26,
        version: '18.0 CE',
        connected_db: 'dealflow_odoo_demo',
      },
    });
  }),

  http.get('*/api/v1/admin/jobs', () => {
    return HttpResponse.json({
      data: [
        { name: 'daily_health_check', status: 'IDLE', last_run: new Date().toISOString() },
        { name: 'nightly_governance_sync', status: 'IDLE', last_run: new Date().toISOString() },
      ],
    });
  }),

  http.post('*/api/v1/admin/jobs/run/:name', () => {
    return HttpResponse.json({ message: 'Background job triggered successfully' });
  }),

  // Customer Portal Additions
  http.post('*/api/v1/portal/deals/:id/negotiations/:reqId/withdraw', ({ params }) => {
    const reqId = String(params.reqId);
    mockState.goldenDeal.negotiation.open_requests = mockState.goldenDeal.negotiation.open_requests.filter(
      (r) => r.id !== reqId
    );
    return HttpResponse.json({ message: 'Proposal withdrawn successfully' });
  }),

  http.post('*/api/v1/portal/deals/:id/comments', async ({ request }) => {
    const body = (await request.json()) as any;
    const comment = {
      id: `c_${Date.now()}`,
      author_name: 'Customer (Acme Corp)',
      author_role: 'CUSTOMER',
      body: body.body || '',
      created_at: new Date().toISOString(),
      is_internal: false,
    };
    mockState.goldenDeal.negotiation.comments.push(comment);
    return HttpResponse.json({ data: comment });
  }),

  http.get('*/api/v1/portal/deals/:id/billing', () => {
    return HttpResponse.json({ data: mockState.goldenDeal.billing });
  }),

  http.get('*/api/v1/portal/deals/:id/revisions', () => {
    return HttpResponse.json({
      data: [
        {
          version: 1,
          created_at: new Date().toISOString(),
          total: mockState.goldenDeal.quote.totals.total,
          status: mockState.goldenDeal.deal.status,
        },
      ],
    });
  }),

  http.get('*/api/v1/portal/notifications', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'pnotif_1',
          title: 'Quotation Available',
          body: 'Your quotation D-1024 is ready for online review and negotiation.',
          created_at: new Date().toISOString(),
        },
      ],
    });
  }),
];

function recalculateQuoteTotals(quote: any) {
  let subtotal = 0;
  let totalCost = 0;
  for (const line of quote.lines) {
    const disc = line.discount_pct || 0;
    line.effective_discount_pct = disc;
    line.overage_pts = Math.max(0, disc - (line.ceiling_pct || 10));
    const lineGross = (line.price_unit || 0) * (line.qty || 1);
    line.net_value = Math.round(lineGross * (1 - disc / 100));
    const lineCost = (line.unit_cost || 0) * (line.qty || 1);
    line.margin = line.net_value - lineCost;
    subtotal += line.net_value;
    totalCost += lineCost;
  }
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;
  const margin_amount = subtotal - totalCost;
  const margin_pct = subtotal > 0 ? Number(((margin_amount / subtotal) * 100).toFixed(1)) : 0;
  quote.totals = {
    net: subtotal,
    tax,
    total,
    margin_amount,
    margin_pct,
  };
}

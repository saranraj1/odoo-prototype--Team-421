import { http, HttpResponse } from 'msw';
import { mockState } from './state';

export const handlers = [
  // Auth
  http.post('/api/v1/auth/login', async ({ request }) => {
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

  http.post('/api/v1/auth/signup', async ({ request }) => {
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
  http.get('/api/v1/users', () => {
    return HttpResponse.json({ data: Object.values(mockState.users) });
  }),

  http.post('/api/v1/users', async ({ request }) => {
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

  http.patch('/api/v1/users/:id', async ({ params, request }) => {
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

  http.delete('/api/v1/users/:id', ({ params }) => {
    const id = Number(params.id);
    const key = Object.keys(mockState.users).find((k) => mockState.users[k].id === id);
    if (key) {
      mockState.removeUser(key);
    }
    return HttpResponse.json({ message: 'User deleted' });
  }),

  http.post('/api/v1/portal/auth/login', async ({ request }) => {
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

  http.get('/api/v1/auth/me', () => {
    return HttpResponse.json({ data: mockState.users.rep1 });
  }),

  http.post('/api/v1/portal/auth/magic-link', () => {
    return HttpResponse.json({ message: 'Magic link dispatched' }, { status: 202 });
  }),

  http.get('/api/v1/portal/auth/verify', () => {
    return HttpResponse.json({
      data: {
        access_token: 'mock_jwt_portal_acme',
        token_type: 'bearer',
        partner: { id: 1, name: 'Acme Corp' },
      },
    });
  }),

  http.post('/api/v1/portal/auth/exchange', () => {
    return HttpResponse.json({
      data: {
        access_token: 'mock_jwt_portal_acme',
        token_type: 'bearer',
        partner: { id: 1, name: 'Acme Corp' },
      },
    });
  }),

  http.get('/api/v1/portal/me', () => {
    return HttpResponse.json({ data: { id: 1, name: 'Acme Corp' } });
  }),

  // Deals
  http.get('/api/v1/deals', ({ request }) => {
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

  http.get('/api/v1/deals/:id/workspace', ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    return HttpResponse.json({ data: ws });
  }),

  // Approvals List & Inbox — role-aware filtering
  http.get('/api/v1/approvals', ({ request }) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status')?.toUpperCase();
    const pendingParam = url.searchParams.get('pending');

    // Determine role from Authorization header
    const authHeader = (request.headers.get('Authorization') || '').toLowerCase();
    const isAdmin = authHeader.includes('admin');
    const isFinance = authHeader.includes('finance');
    const isManager = (authHeader.includes('manager') || authHeader.includes('sales_manager')) && !isAdmin;
    const isRep = (authHeader.includes('sales_rep') || authHeader.includes('_rep')) && !isManager && !isAdmin && !isFinance;

    let items = [...mockState.approvals];

    // Role-based stage filtering: each role sees their own queue + history
    if (isFinance) {
      items = items.filter((a) => a.stage === 'Finance');
    } else if (isManager) {
      items = items.filter((a) => a.stage === 'Sales Manager');
    } else if (isRep) {
      // Reps see RETURNED items (sent back to them) and their own submitted items
      items = items.filter((a) => a.status === 'RETURNED' || a.stage === 'Sales Rep');
    }
    // Admin sees all items (no stage filter)

    // Status filtering
    if (statusParam && statusParam !== 'ALL') {
      items = items.filter((a) => a.status === statusParam);
    } else if (pendingParam === 'true') {
      items = items.filter((a) => a.status === 'PENDING');
    }

    return HttpResponse.json({ data: items });
  }),

  http.get('/api/v1/approvals/inbox', ({ request }) => {
    const authHeader = (request.headers.get('Authorization') || '').toLowerCase();
    const isAdmin = authHeader.includes('admin');
    const isFinance = authHeader.includes('finance');
    const isManager = (authHeader.includes('manager') || authHeader.includes('sales_manager')) && !isAdmin;

    let items = mockState.approvals.filter((a) => a.status === 'PENDING');

    if (isFinance) {
      items = items.filter((a) => a.stage === 'Finance');
    } else if (isManager) {
      items = items.filter((a) => a.stage === 'Sales Manager');
    }
    // Admin sees all pending

    return HttpResponse.json({ data: items });
  }),

  // Patch Line (Live Quantity & Discount Recalculation + Fulfillment Sync)
  http.patch('/api/v1/deals/:id/lines/:lineId', async ({ params, request }) => {
    const id = String(params.id);
    const lineId = Number(params.lineId);
    const body = (await request.json()) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    const line = ws.quote.lines.find((l) => l.odoo_line_id === lineId);
    if (line) {
      if (body.discount_pct !== undefined) {
        line.discount_pct = Number(body.discount_pct);
        line.effective_discount_pct = line.discount_pct;
      }
      if (body.qty !== undefined) {
        line.qty = Math.max(1, Number(body.qty));
      }
      // recomputeWorkspace now includes fulfillment sync via syncFulfillmentWithQuoteLines
      mockState.recomputeWorkspace(ws);
      mockState.saveWorkspace(id, ws);
      if (id === 'deal_d1024_acme') {
        mockState.goldenDeal = ws;
      }
    }
    return HttpResponse.json({ data: ws });
  }),

  // Add Recommendation (Universal Docking Station)
  http.post('/api/v1/deals/:id/recommendations/:rid/add', ({ params }) => {
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
  http.post('/api/v1/deals/:id/approval/approve', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    const reason = body?.reason || 'Governance review approved';
    const authHeader = (request.headers.get('Authorization') || '').toLowerCase();
    const isFinance = authHeader.includes('finance');
    const isAdmin = authHeader.includes('admin');
    const isManager = authHeader.includes('manager') || authHeader.includes('sales_manager');
    const isRep = (authHeader.includes('sales_rep') || authHeader.includes('_rep')) && !isManager && !isAdmin && !isFinance;

    if (isRep) {
      return HttpResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message:
              'Segregation of Duties Violation: Sales Representatives prepare and submit quotations, but cannot approve governance sign-offs.',
          },
        },
        { status: 403 }
      );
    }

    const currentStage = ws.approval.state || ws.deal.approval_state || 'PENDING_MANAGER';

    if (currentStage === 'PENDING_MANAGER') {
      // Stage 1: Sales Manager Review
      ws.approval.state = 'PENDING_FINANCE';
      ws.deal.approval_state = 'PENDING_FINANCE';
      ws.timeline.unshift({
        id: `t_${Date.now()}`,
        event_type: 'APPROVED_STAGE_1',
        actor_name: isAdmin ? 'Devendra Prasad (Admin)' : 'Sunita Rao (Sales Manager)',
        actor_role: isAdmin ? 'ADMIN' : 'SALES_MANAGER',
        reason,
        created_at: new Date().toISOString(),
        summary: 'Stage 1 Sales Manager approval granted — routed to Commercial Finance',
      });
      ws.next_best_action = {
        type: 'FINANCE_APPROVAL_REQUIRED',
        priority: 1,
        title: 'Stage 2: Awaiting Finance Officer Sign-Off',
        explanation: 'Commercial margins verified by Sales Manager. Awaiting Commercial Finance Director verification.',
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
    } else if (currentStage === 'PENDING_FINANCE') {
      // Stage 2: Finance Review -> routes to Admin
      ws.approval.state = 'PENDING_ADMIN';
      ws.deal.approval_state = 'PENDING_ADMIN';
      ws.timeline.unshift({
        id: `t_${Date.now()}`,
        event_type: 'APPROVED_STAGE_2',
        actor_name: isAdmin ? 'Devendra Prasad (Admin)' : 'Vikram Mehta (Finance Officer)',
        actor_role: isAdmin ? 'ADMIN' : 'FINANCE',
        reason,
        created_at: new Date().toISOString(),
        summary: 'Stage 2 Finance approval granted — routed to Executive Admin for final sign-off',
      });
      ws.next_best_action = {
        type: 'ADMIN_APPROVAL_REQUIRED',
        priority: 1,
        title: 'Stage 3: Awaiting Executive Admin Final Approval',
        explanation: 'Financial exposure approved. Awaiting Admin final operational verification.',
        cta_endpoint: `/approvals/${id}`,
      };
      const app = mockState.approvals.find((a) => a.id === id);
      if (app) {
        app.stage = 'Admin / Executive';
        app.assigned_to = 'Devendra Prasad (Admin)';
      }
      const d = mockState.deals.find((x) => x.id === id);
      if (d) {
        d.approval_state = 'PENDING_ADMIN';
      }
    } else {
      // Stage 3: Admin Final Approval -> Fully APPROVED
      ws.approval.state = 'APPROVED';
      ws.deal.approval_state = 'APPROVED';
      ws.approval.can_decide = false;
      ws.timeline.unshift({
        id: `t_${Date.now()}`,
        event_type: 'APPROVED_FINAL',
        actor_name: 'Devendra Prasad (Executive Admin)',
        actor_role: 'ADMIN',
        reason,
        created_at: new Date().toISOString(),
        summary: 'Final Executive Admin approval granted — Quotation unlocked for ERP order confirmation',
      });
      ws.next_best_action = {
        type: 'CONFIRM_ORDER',
        priority: 1,
        title: 'Governance Complete — Ready to Confirm Order',
        explanation: 'All multi-tier internal approvals (Manager, Finance, Admin) granted. Order ready to commit to Odoo ERP.',
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

    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    mockState.saveApprovals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('/api/v1/deals/:id/approval/reject', async ({ params, request }) => {
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

    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    mockState.saveApprovals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('/api/v1/deals/:id/approval/return', async ({ params, request }) => {
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

    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    mockState.saveApprovals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('/api/v1/deals/:id/approval/escalate', async ({ params, request }) => {
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

    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    mockState.saveApprovals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('/api/v1/deals/:id/submit', async ({ params }) => {
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
    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    mockState.saveApprovals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('/api/v1/deals/:id/cancel', async ({ params, request }) => {
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
    const app = mockState.approvals.find((a) => a.id === id);
    if (app) {
      app.status = 'REJECTED';
    }
    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    mockState.saveApprovals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('/api/v1/deals/:id/send', ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    ws.deal.status = 'SENT';
    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'SENT',
      actor_name: 'Sales Rep One',
      actor_role: 'SALES_REP',
      reason: 'Quotation published to Customer Portal',
      created_at: new Date().toISOString(),
      summary: 'Quotation sent to customer for review',
    });
    ws.next_best_action = {
      type: 'FOLLOW_UP_CUSTOMER',
      priority: 2,
      title: 'Awaiting Customer Response',
      explanation: 'Quotation active in customer portal.',
    };
    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.status = 'SENT';
    }
    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  // Portal negotiation proposal
  http.post('/api/v1/portal/deals/:id/negotiations', async ({ params, request }) => {
    const id = String(params?.id || 'deal_d1024_acme');
    const body = (await request.json().catch(() => ({}))) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    ws.deal.status = 'UNDER_NEGOTIATION';

    const reqId = `neg_req_${Date.now()}`;
    const newReq = {
      id: reqId,
      type: body.type || 'COUNTER_DISCOUNT',
      status: 'OPEN',
      line_id: body.line_id || null,
      product_id: body.product_id || null,
      product_name: body.product_name || (body.line_id ? ws.quote.lines.find(l => l.odoo_line_id === body.line_id)?.product_name : 'Quotation Proposal'),
      line_name: body.product_name || 'Quotation Proposal',
      requested_qty: body.requested_qty || 1,
      message: body.message || 'Customer submitted commercial proposal',
      requested_value: body.requested_value || 15,
      created_at: new Date().toISOString(),
    };

    ws.negotiation.open_requests.push(newReq);

    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'CUSTOMER_PROPOSAL',
      actor_name: 'Customer (Portal)',
      actor_role: 'CUSTOMER',
      reason: body.message || `Customer requested: ${newReq.line_name}`,
      created_at: new Date().toISOString(),
      summary: body.type === 'ADD_ITEM_REQUEST' 
        ? `Customer requested adding ${body.requested_qty || 1}x ${body.product_name}` 
        : `Customer proposed ${body.requested_value || 15}% counter concession`,
    });

    ws.next_best_action = {
      type: 'REVIEW_PROPOSAL',
      priority: 1,
      title: 'Customer Proposal Received',
      explanation: body.type === 'ADD_ITEM_REQUEST' 
        ? `Customer requested adding ${body.requested_qty || 1}x ${body.product_name} from warehouse stock.` 
        : `Customer submitted counter-offer. Review proposal and update quotation.`,
      cta_endpoint: `/quotations/${id}`,
    };

    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.status = 'UNDER_NEGOTIATION';
      d.approval_state = 'UNDER_NEGOTIATION';
    }

    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: { message: 'Customer proposal submitted successfully.' } });
  }),

  // Sales Rep accepts proposal & adds requested items from warehouse
  http.post('/api/v1/deals/:id/accept-proposal-and-add-item', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as any;
    const ws = mockState.getOrCreateWorkspace(id);

    const reqId = body.request_id;
    const prodId = Number(body.product_id) || 101;
    const qty = Math.max(1, Number(body.qty) || 1);
    const prod = mockState.products.find((p) => p.id === prodId) || mockState.products[0];

    const price_unit = prod.list_price || 125000;
    const unit_cost = (prod as any).standard_price || Math.round(price_unit * 0.7);
    const discount_pct = Number(body.discount_pct) || 0;
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

    // Mark open request as accepted
    ws.negotiation.open_requests = ws.negotiation.open_requests.filter((r) => r.id !== reqId);

    // Recompute margins & Deal Guardian risk
    mockState.recomputeWorkspace(ws);

    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'PROPOSAL_ACCEPTED',
      actor_name: 'Sales Rep One',
      actor_role: 'SALES_REP',
      reason: `Added ${qty}x ${prod.name} from warehouse inventory to quotation list.`,
      created_at: new Date().toISOString(),
      summary: `Added requested warehouse product: ${prod.name}`,
    });

    ws.next_best_action = {
      type: 'SEND_TO_CUSTOMER',
      priority: 1,
      title: 'Quotation Updated with Warehouse Stock — Ready to Re-Send',
      explanation: `Added ${qty}x ${prod.name}. Live margin recalculated. Re-send to customer for order confirmation.`,
      cta_endpoint: `/quotations/${id}`,
    };

    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.amount_total_cache = ws.quote.totals.total;
    }

    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  // Sales Rep or Sales Manager accepts/rejects customer counter-offer
  http.post('/api/v1/deals/:id/negotiations/:nid/respond', async ({ params, request }) => {
    const id = String(params.id);
    const nid = String(params.nid);
    const body = (await request.json()) as any;
    const ws = mockState.getOrCreateWorkspace(id);
    const authHeader = (request.headers.get('Authorization') || '').toLowerCase();
    const isManager = authHeader.includes('manager') || authHeader.includes('sales_manager');
    const isAdmin = authHeader.includes('admin');

    // Determine actor from body (sent by client) or fallback to auth header
    const actorRole = body.actor_role || (isAdmin ? 'ADMIN' : isManager ? 'SALES_MANAGER' : 'SALES_REP');
    const actorName = body.actor_name || (isAdmin ? 'Admin' : isManager ? 'Sunita Rao (Sales Manager)' : 'Sales Rep One');

    // Find the open request being responded to
    const openReq = ws.negotiation.open_requests.find((r) => r.id === nid);

    // Remove resolved request from open requests
    ws.negotiation.open_requests = ws.negotiation.open_requests.filter(
      (r) => r.id !== nid && r.id !== 'neg_req_counter_22'
    );

    if (body.decision === 'ACCEPT') {
      // Determine what type of counter was accepted
      const isCounterAmount = openReq?.type === 'COUNTER_AMOUNT' || body.type === 'COUNTER_AMOUNT';
      const isCounterDiscount = openReq?.type === 'COUNTER_DISCOUNT' || openReq?.requested_value;

      if (isCounterAmount && body.target_amount) {
        // Customer proposed a specific total amount — apply order-level discount to achieve it
        const currentNet = ws.quote.totals?.net || ws.quote.totals?.total || 500000;
        const targetAmount = Number(body.target_amount);
        if (targetAmount > 0 && targetAmount < currentNet) {
          const reductionPct = Math.round(((currentNet - targetAmount) / currentNet) * 100 * 10) / 10;
          ws.deal.order_discount_pct = (ws.deal.order_discount_pct || 0) + reductionPct;
          for (const line of ws.quote.lines) {
            line.effective_discount_pct = line.discount_pct + (ws.deal.order_discount_pct || 0);
            line.overage_pts = Math.max(0, line.effective_discount_pct - line.ceiling_pct);
          }
        }
      } else if (isCounterDiscount || openReq?.requested_value) {
        // Customer proposed a percentage discount — apply to specific line or whole order
        const requestedDiscount = openReq?.requested_value || 22;
        const targetLineId = openReq?.line_id;
        if (targetLineId) {
          const line = ws.quote.lines.find((l) => l.odoo_line_id === targetLineId);
          if (line) {
            line.discount_pct = requestedDiscount;
            line.effective_discount_pct = requestedDiscount;
            line.overage_pts = Math.max(0, requestedDiscount - line.ceiling_pct);
          }
        } else {
          // Apply as order-level discount
          ws.deal.order_discount_pct = requestedDiscount;
          for (const line of ws.quote.lines) {
            line.effective_discount_pct = line.discount_pct + requestedDiscount;
            line.overage_pts = Math.max(0, line.effective_discount_pct - line.ceiling_pct);
          }
        }
      }

      // Recompute workspace (includes margins, risk, fulfillment sync)
      mockState.recomputeWorkspace(ws);

      // If terms worsened significantly, invalidate approval
      const newScore = ws.risk.score;
      const prevScore = ws.risk.previous_score || newScore;
      if (newScore > 50 || (newScore - prevScore > 10)) {
        ws.risk.previous_score = prevScore;
        ws.approval.state = 'PENDING_MANAGER';
        ws.deal.approval_state = 'PENDING_MANAGER';

        ws.timeline.unshift({
          id: `t_${Date.now()}_invalidate`,
          event_type: 'APPROVAL_INVALIDATED',
          actor_name: 'Deal Guardian',
          actor_role: 'SYSTEM',
          reason: `Counter-offer accepted by ${actorName}. Terms changed — re-approval required.`,
          created_at: new Date().toISOString(),
          summary: 'Previous approval invalidated — terms worsened after customer counter-offer',
        });

        ws.next_best_action = {
          type: 'REAPPROVAL_REQUIRED',
          priority: 1,
          title: `Re-Approval Required (Risk ${newScore} ${ws.risk.severity})`,
          explanation: `Counter-offer accepted by ${actorName}. Deal requires re-review by Sales Manager & Finance.`,
          cta_endpoint: `/approvals/${id}`,
        };
      } else {
        ws.next_best_action = {
          type: 'SEND_TO_CUSTOMER',
          priority: 1,
          title: 'Negotiation Accepted — Re-Send Updated Quotation',
          explanation: `Customer negotiation accepted by ${actorName}. Quotation updated with agreed terms. Ready to send.`,
          cta_endpoint: undefined,
        };
      }

      ws.timeline.unshift({
        id: `t_${Date.now()}`,
        event_type: 'NEGOTIATION_ACCEPTED',
        actor_name: actorName,
        actor_role: actorRole,
        reason: `Customer negotiation accepted. ${openReq?.message || 'Counter-offer terms applied to quotation.'}`,
        created_at: new Date().toISOString(),
        summary: `Customer counter-offer accepted by ${actorRole.toLowerCase().replace('_', ' ')}`,
      });

      const d = mockState.deals.find((x) => x.id === id);
      if (d) {
        d.amount_total_cache = ws.quote.totals.total;
        d.current_risk_score = ws.risk.score;
        d.current_severity = ws.risk.severity;
      }

    } else {
      // Rejected / Declined
      ws.timeline.unshift({
        id: `t_${Date.now()}`,
        event_type: 'NEGOTIATION_DECLINED',
        actor_name: actorName,
        actor_role: actorRole,
        reason: body.message || 'Customer counter-offer declined.',
        created_at: new Date().toISOString(),
        summary: `Customer counter-offer declined by ${actorRole.toLowerCase().replace('_', ' ')}`,
      });

      ws.next_best_action = {
        type: 'FOLLOW_UP_CUSTOMER',
        priority: 2,
        title: 'Counter-Offer Declined — Follow Up with Customer',
        explanation: 'Customer proposal was declined. You may counter-offer with revised terms or wait for customer response.',
        cta_endpoint: undefined,
      };
    }

    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  // Portal Confirm
  http.post('/api/v1/portal/deals/:id/confirm', ({ params }) => {
    const id = String(params?.id || 'deal_d1024_acme');
    const ws = mockState.getOrCreateWorkspace(id);
    ws.deal.customer_confirmed_pending = true;
    ws.deal.status = 'CONFIRMED';
    ws.deal.confirmed_at = new Date().toISOString();
    ws.deal.approval_state = 'APPROVED';
    ws.approval.state = 'APPROVED';
    ws.approval.can_decide = false;

    // Generate or update Invoice with all quotation lines and latest total
    const existingInvIndex = mockState.invoices.findIndex((i) => i.deal_id === id || i.deal_reference === ws.deal.reference);
    const newInvId = existingInvIndex >= 0 ? mockState.invoices[existingInvIndex].id : 1050 + mockState.invoices.length;
    const invoiceNumber = existingInvIndex >= 0 ? mockState.invoices[existingInvIndex].number : `INV-${newInvId}`;

    const invLines = ws.quote.lines.map((l, idx) => ({
      id: idx + 1,
      product_name: l.product_name,
      qty: l.qty,
      price_unit: l.price_unit,
      discount_pct: l.discount_pct,
      net_value: l.net_value,
      tax: 18,
    }));

    const invoiceRecord = {
      id: newInvId,
      number: invoiceNumber,
      customer: ws.customer.name,
      deal_id: id,
      deal_reference: ws.deal.reference,
      amount: ws.quote.totals.total || ws.deal.amount_total_cache,
      status: 'Unpaid',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      lines: invLines,
    };

    if (existingInvIndex >= 0) {
      mockState.invoices[existingInvIndex] = invoiceRecord;
    } else {
      mockState.invoices.unshift(invoiceRecord);
    }
    mockState.saveInvoices();

    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'CONFIRMED',
      actor_name: 'Customer (Portal)',
      actor_role: 'CUSTOMER',
      reason: `Customer electronically accepted quotation terms in portal. Generated Invoice ${invoiceNumber}.`,
      created_at: new Date().toISOString(),
      summary: `Quotation confirmed by customer on Portal. Invoice ${invoiceNumber} created.`,
    });

    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.status = 'CONFIRMED';
      d.approval_state = 'APPROVED';
    }
    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({
      data: {
        status: 'CONFIRMED',
        invoice_number: invoiceNumber,
        message: `Your confirmation has been registered. Official invoice ${invoiceNumber} generated.`,
      },
    });
  }),

  // Internal Confirm (Once approved by Admin/Manager)
  http.post('/api/v1/deals/:id/confirm', ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    ws.deal.status = 'CONFIRMED';
    ws.deal.approval_state = 'APPROVED';
    ws.deal.confirmed_at = new Date().toISOString();
    ws.approval.state = 'APPROVED';
    ws.approval.can_decide = false;

    // Generate or update Invoice with all quotation lines and latest total
    const existingInvIndex = mockState.invoices.findIndex((i) => i.deal_id === id || i.deal_reference === ws.deal.reference);
    const newInvId = existingInvIndex >= 0 ? mockState.invoices[existingInvIndex].id : 1050 + mockState.invoices.length;
    const invoiceNumber = existingInvIndex >= 0 ? mockState.invoices[existingInvIndex].number : `INV-${newInvId}`;

    const invLines = ws.quote.lines.map((l, idx) => ({
      id: idx + 1,
      product_name: l.product_name,
      qty: l.qty,
      price_unit: l.price_unit,
      discount_pct: l.discount_pct,
      net_value: l.net_value,
      tax: 18,
    }));

    const invoiceRecord = {
      id: newInvId,
      number: invoiceNumber,
      customer: ws.customer.name,
      deal_id: id,
      deal_reference: ws.deal.reference,
      amount: ws.quote.totals.total || ws.deal.amount_total_cache,
      status: 'Unpaid',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      lines: invLines,
    };

    if (existingInvIndex >= 0) {
      mockState.invoices[existingInvIndex] = invoiceRecord;
    } else {
      mockState.invoices.unshift(invoiceRecord);
    }
    mockState.saveInvoices();

    // Post completed details as message in customer quotation page
    ws.negotiation.comments.push({
      id: `comm_${Date.now()}`,
      author_id: 1,
      author_name: 'Commercial Governance (Admin)',
      author_role: 'ADMIN',
      text: `Order Confirmed: All internal governance approvals (Sales Rep, Sales Manager, Finance, and Executive Admin) are successfully completed. Sales Order committed to Odoo ERP. Official Invoice ${invoiceNumber} has been generated with all itemized lines and released to fulfillment.`,
      created_at: new Date().toISOString(),
      is_internal: false,
    });

    ws.timeline.unshift({
      id: `t_${Date.now()}`,
      event_type: 'CONFIRMED',
      actor_name: 'Devendra Prasad (Admin)',
      actor_role: 'ADMIN',
      reason: `Sales order confirmed by Admin. Invoice ${invoiceNumber} generated.`,
      created_at: new Date().toISOString(),
      summary: `Order confirmed and invoice ${invoiceNumber} committed to Odoo ERP`,
    });

    ws.next_best_action = {
      type: 'ORDER_CONFIRMED',
      priority: 1,
      title: 'Order Confirmed & Synchronized with Odoo ERP',
      explanation: `Sales Order committed. Invoice ${invoiceNumber} generated. Released to fulfillment.`,
      cta_endpoint: '/invoices',
    };

    const d = mockState.deals.find((x) => x.id === id);
    if (d) {
      d.status = 'CONFIRMED';
      d.approval_state = 'APPROVED';
    }
    const app = mockState.approvals.find((a) => a.id === id);
    if (app) {
      app.status = 'APPROVED';
    }

    mockState.saveWorkspace(id, ws);
    mockState.saveDeals();
    mockState.saveApprovals();
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  // Portal Deal Detail (strictly whitelisted, dynamic for any deal)
  http.get('/api/v1/portal/deals/:id', ({ params }) => {
    const id = String(params.id || 'deal_d1024_acme');
    const d = mockState.getOrCreateWorkspace(id);
    return HttpResponse.json({
      data: {
        id: d.deal.id,
        number: d.deal.reference,
        odoo_order_name: d.deal.odoo_order_name,
        portal_status: d.deal.customer_confirmed_pending
          ? 'UNDER_REVIEW'
          : d.deal.status === 'CONFIRMED'
          ? 'CONFIRMED'
          : d.deal.status === 'UNDER_NEGOTIATION'
          ? 'UNDER_NEGOTIATION'
          : 'APPROVED',
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

  http.get('/api/v1/portal/deals', () => {
    const items = mockState.deals.slice(0, 10).map((d) => ({
      id: d.id,
      number: d.reference,
      portal_status: d.status === 'CONFIRMED' ? 'CONFIRMED' : d.status === 'UNDER_NEGOTIATION' ? 'UNDER_NEGOTIATION' : 'APPROVED',
      total: d.amount_total_cache,
      currency_code: d.currency_code,
      updated_at: d.last_activity_at || new Date().toISOString(),
    }));
    return HttpResponse.json({ data: items });
  }),

  http.get('/api/v1/odoo/invoices/:id', ({ params }) => {
    const invId = Number(params.id);
    const inv = mockState.invoices.find((i) => i.id === invId) || mockState.invoices[0];
    return HttpResponse.json({ data: inv });
  }),

  // Control Tower — Dynamic Live Statistics from Database
  http.get('/api/v1/dashboard/control-tower', () => {
    const allDeals = mockState.deals || [];
    const allApprovals = mockState.approvals || [];
    const allAlerts = mockState.alerts || [];

    // Pending Approvals from database
    const pendingApprovalsCount = allApprovals.filter(
      (a: any) => a.status === 'PENDING' || (typeof a.status === 'string' && a.status.startsWith('PENDING'))
    ).length;

    // Active pipeline quotations (non-cancelled / non-rejected)
    const openDeals = allDeals.filter(
      (d: any) => d.status !== 'CANCELLED' && d.status !== 'REJECTED'
    );

    // Live Total Pipeline Value
    const pipelineValue = openDeals.reduce(
      (sum: number, d: any) => sum + (d.amount_total_cache || 0),
      0
    );

    // At-Risk Deals (high risk score >= 40 or flagged health)
    const atRiskDeals = allDeals.filter(
      (d: any) =>
        (d.current_risk_score && d.current_risk_score >= 40) ||
        d.health_status === 'AT_RISK' ||
        d.current_severity === 'HIGH'
    );
    const atRiskCount = atRiskDeals.length;

    // Stalled Deals (idle > 7 days or health_status === 'STALLED')
    const stalledCount = allDeals.filter(
      (d: any) => d.health_status === 'STALLED'
    ).length;

    // Fulfillment Risk Count from alerts
    const fulfillmentRiskCount = allAlerts.filter(
      (a: any) =>
        (a.category === 'FULFILLMENT' ||
          a.category === 'DELIVERY' ||
          a.title?.toLowerCase().includes('fulfillment') ||
          a.title?.toLowerCase().includes('stock')) &&
        a.status === 'ACTIVE'
    ).length;

    // Discount Exposure Amount across open deals
    const discountExposure = openDeals.reduce((sum: number, d: any) => {
      const amount = d.amount_total_cache || 0;
      const score = d.current_risk_score || 0;
      return sum + Math.round(amount * (score > 30 ? 0.08 : 0.03));
    }, 0);

    // Build dynamic Action Queue from active pending approvals + high risk alerts
    const dynamicActionQueue = [
      ...allApprovals
        .filter((a: any) => a.status === 'PENDING')
        .map((a: any, idx: number) => ({
          kind: 'APPROVAL' as const,
          id: `queue_app_${a.id}_${idx}`,
          deal_id: a.id,
          reference: a.reference || 'D-1024',
          customer: a.customer || 'Customer',
          title: `${a.severity || 'HIGH'} Risk Quotation requires ${a.stage || 'Manager'} Approval (${a.reference})`,
          severity: a.severity || 'HIGH',
          priority: idx + 1,
          raised_at: a.created_at || new Date().toISOString(),
          deep_link: `/approvals/${a.id}`,
        })),
      ...allAlerts
        .filter((al: any) => al.status === 'ACTIVE')
        .map((al: any, idx: number) => ({
          kind: 'ALERT' as const,
          id: `queue_alt_${al.id}_${idx}`,
          deal_id: al.deal_id,
          reference: al.reference || 'D-Alert',
          customer: al.customer || 'Account',
          title: al.title || 'Deal Health Alert Requires Attention',
          severity: al.severity || 'MEDIUM',
          priority: idx + 10,
          raised_at: al.created_at || new Date().toISOString(),
          deep_link: '/deal-health',
        })),
    ];

    mockState.controlTower.kpis = {
      pipeline_value: pipelineValue,
      at_risk_count: atRiskCount,
      pending_approvals: pendingApprovalsCount,
      discount_exposure_amount: discountExposure,
      stalled_count: stalledCount || 1,
      avg_approval_hours: 6.4,
      fulfillment_risk_count: fulfillmentRiskCount || 1,
    };

    if (dynamicActionQueue.length > 0) {
      mockState.controlTower.action_queue = dynamicActionQueue;
    }

    return HttpResponse.json({ data: mockState.controlTower });
  }),


  // Alerts
  http.get('/api/v1/alerts', () => {
    return HttpResponse.json({ data: mockState.alerts });
  }),

  http.post('/api/v1/alerts/recompute', () => {
    return HttpResponse.json({ message: 'Alerts recomputed successfully' });
  }),

  // Notifications
  http.get('/api/v1/notifications', ({ request }) => {
    const authHeader = request.headers.get('Authorization') || '';
    let userRole = '';
    let userId = 0;
    if (authHeader.startsWith('Bearer mock_jwt_')) {
      const parts = authHeader.replace('Bearer mock_jwt_', '').split('_');
      userId = parseInt(parts[parts.length - 1], 10) || 0;
      userRole = parts.slice(0, parts.length - 1).join('_').toUpperCase();
    }

    const filtered = mockState.notifications.filter((n: any) => {
      // System Admin sees all notifications for audit purposes
      if (userRole === 'ADMIN') return true;
      // Match specific user ID if set
      if (n.recipient_odoo_user_id && userId && n.recipient_odoo_user_id === userId) return true;
      // Match specific target role
      if (n.recipient_role) {
        if (Array.isArray(n.recipient_role)) {
          return n.recipient_role.includes(userRole);
        }
        return n.recipient_role === userRole;
      }
      // General notifications visible to all staff
      return true;
    });

    return HttpResponse.json({ data: filtered });
  }),

  http.post('/api/v1/notifications/:id/read', ({ params }) => {
    const notif = mockState.notifications.find((n) => n.id === params.id);
    if (notif) notif.is_read = true;
    return HttpResponse.json({ message: 'Marked read' });
  }),

  http.post('/api/v1/notifications/read-all', () => {
    mockState.notifications.forEach((n) => (n.is_read = true));
    return HttpResponse.json({ message: 'All marked read' });
  }),


  // Odoo Proxies
  http.get('/api/v1/odoo/products', ({ request }) => {
    const url = new URL(request.url);
    const cat = url.searchParams.get('category');
    const q = (url.searchParams.get('q') || '').toLowerCase();
    let prods = [...mockState.products];
    if (cat && cat !== 'all') {
      prods = prods.filter(
        (p) => String(p.category_id) === cat || p.category_name?.toLowerCase() === cat.toLowerCase()
      );
    }
    if (q) {
      prods = prods.filter(
        (p) => p.name.toLowerCase().includes(q) || p.default_code?.toLowerCase().includes(q)
      );
    }
    return HttpResponse.json({ data: prods });
  }),

  http.get('/api/v1/odoo/products/:id', ({ params }) => {
    const p = mockState.products.find((prod) => prod.id === Number(params.id));
    return HttpResponse.json({ data: p || mockState.products[0] });
  }),

  http.get('/api/v1/odoo/partners', () => {
    return HttpResponse.json({ data: mockState.partners });
  }),

  http.get('/api/v1/odoo/warehouses', () => {
    return HttpResponse.json({ data: mockState.warehouses });
  }),

  http.get('/api/v1/odoo/categories', () => {
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
  http.get('/api/v1/admin/outbox', () => {
    return HttpResponse.json({ data: mockState.outbox });
  }),

  // Invoices List
  http.get('/api/v1/odoo/invoices', ({ request }) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status')?.toLowerCase();
    let items = [...mockState.invoices];
    if (statusParam && statusParam !== 'all') {
      items = items.filter((i) => i.status.toLowerCase() === statusParam);
    }
    return HttpResponse.json({ data: items });
  }),

  // Subscriptions List
  http.get('/api/v1/odoo/subscriptions', ({ request }) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status')?.toUpperCase();
    let items = [...mockState.subscriptions];
    if (statusParam && statusParam !== 'ALL') {
      items = items.filter((s) => s.status.toUpperCase() === statusParam);
    }
    return HttpResponse.json({ data: items });
  }),

  // Fulfillment Exceptions
  http.get('/api/v1/fulfillment/exceptions', () => {
    return HttpResponse.json({ data: mockState.fulfillmentExceptions });
  }),

  // Deals Management (Creation, Re-evaluation, Patching, Lines)
  http.post('/api/v1/deals', async ({ request }) => {
    const body = (await request.json()) as any;
    const partnerId = Number(body.partner_id) || 1;
    const partner = mockState.partners.find((p) => p.id === partnerId) || mockState.partners[0];
    const timestamp = Date.now();
    const newId = `deal_d${timestamp}`;
    const refNum = Math.floor(1000 + Math.random() * 9000);
    const reference = `D-${refNum}`;

    // Detect actor role from Authorization header
    const authHeader = (request.headers.get('Authorization') || '').toLowerCase();
    const isManager = authHeader.includes('manager') || authHeader.includes('sales_manager');
    const isAdmin = authHeader.includes('admin');
    const actorName = isAdmin ? 'Devendra Prasad (Admin)' : isManager ? 'Sunita Rao (Sales Manager)' : 'Sales Rep One';
    const actorRole = isAdmin ? 'ADMIN' : isManager ? 'SALES_MANAGER' : 'SALES_REP';
    const ownerObj = isManager
      ? { id: 2, name: 'Sunita Rao (Sales Manager)' }
      : isAdmin
      ? { id: 1, name: 'Devendra Prasad (Admin)' }
      : { id: 4, name: 'Sales Rep One' };

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
        actor_name: actorName,
        actor_role: actorRole,
        reason: `Quotation initiated by ${actorName} from DealFlow360 workspace`,
        created_at: new Date().toISOString(),
        summary: `Created quotation ${reference} for ${partner.name} by ${actorRole.toLowerCase().replace('_', ' ')}`,
      },
    ];

    // Initialize a basic fulfillment plan for the new deal
    const stockableLines = lines.filter((l: any) => l.product_type === 'STOCKABLE');
    newWs.fulfillment.plan.lines = stockableLines.flatMap((l: any) => [
      {
        odoo_sale_order_line_id: l.odoo_line_id,
        product_name: l.product_name,
        odoo_warehouse_id: 1,
        warehouse_name: 'Main Warehouse',
        requested_qty: l.qty,
        allocated_qty: Math.min(l.qty, Math.ceil(l.qty * 0.8)),
        backorder_qty: Math.max(0, l.qty - Math.min(l.qty, Math.ceil(l.qty * 0.8))),
        shipping_cost: 15.0,
      },
    ]);
    newWs.fulfillment.plan.estimated_shipments = 1;
    newWs.fulfillment.plan.estimated_shipping_cost = 15.0;
    newWs.fulfillment.plan.algorithm_notes = `Allocated from Main Warehouse for ${stockableLines.length} product line(s).`;

    mockState.workspaces[newId] = newWs;
    mockState.saveWorkspace(newId, newWs);
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
      owner: ownerObj,
      version: 1,
    });
    mockState.saveDeals();

    return HttpResponse.json({ data: newWs, id: newId });
  }),

  http.post('/api/v1/deals/from-odoo', () => {
    return HttpResponse.json({ data: mockState.goldenDeal });
  }),

  http.post('/api/v1/deals/:id/evaluate', ({ params }) => {
    const id = String(params.id);
    const ws = mockState.getOrCreateWorkspace(id);
    mockState.recomputeWorkspace(ws);
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

  http.patch('/api/v1/deals/:id', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json()) as any;
    const ws = mockState.getOrCreateWorkspace(id);

    if (body.order_discount_pct !== undefined) {
      ws.deal.order_discount_pct = Number(body.order_discount_pct);
      for (const line of ws.quote.lines) {
        line.effective_discount_pct = line.discount_pct + ws.deal.order_discount_pct;
        line.overage_pts = Math.max(0, line.effective_discount_pct - line.ceiling_pct);
      }
      mockState.recomputeWorkspace(ws);
    }
    if (body.status) {
      ws.deal.status = body.status;
    }
    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.post('/api/v1/deals/:id/lines', async ({ params, request }) => {
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

    mockState.recomputeWorkspace(ws);

    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  http.delete('/api/v1/deals/:id/lines/:lineId', ({ params }) => {
    const id = String(params.id);
    const lineId = Number(params.lineId);
    const ws = mockState.getOrCreateWorkspace(id);

    ws.quote.lines = ws.quote.lines.filter((l) => l.odoo_line_id !== lineId);
    // recomputeWorkspace includes syncFulfillmentWithQuoteLines — removes matching fulfillment lines
    mockState.recomputeWorkspace(ws);
    mockState.saveWorkspace(id, ws);

    if (id === 'deal_d1024_acme') {
      mockState.goldenDeal = ws;
    }
    return HttpResponse.json({ data: ws });
  }),

  // Recommendations
  http.get('/api/v1/deals/:id/recommendations', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.recommendations || [] });
  }),

  http.post('/api/v1/deals/:id/recommendations/:rid/dismiss', ({ params }) => {
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
  http.get('/api/v1/deals/:id/timeline', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.timeline || [] });
  }),

  http.get('/api/v1/deals/:id/assessments/:aid', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.risk });
  }),

  http.get('/api/v1/deals/:id/negotiations', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.negotiation.open_requests || [] });
  }),

  http.get('/api/v1/deals/:id/comments', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.negotiation.comments || [] });
  }),

  http.post('/api/v1/deals/:id/comments', async ({ params, request }) => {
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
  http.get('/api/v1/deals/:id/fulfillment', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.fulfillment });
  }),

  http.post('/api/v1/deals/:id/fulfillment/propose', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.fulfillment });
  }),

  http.post('/api/v1/deals/:id/fulfillment/accept', ({ params }) => {
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

  http.post('/api/v1/deals/:id/fulfillment/override', async ({ params, request }) => {
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

  http.post('/api/v1/deals/:id/fulfillment/apply', ({ params }) => {
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

  http.post('/api/v1/deals/:id/fulfillment/consolidate', ({ params }) => {
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
  http.get('/api/v1/deals/:id/billing', ({ params }) => {
    const ws = mockState.getOrCreateWorkspace(String(params.id));
    return HttpResponse.json({ data: ws.billing });
  }),

  http.post('/api/v1/deals/:id/billing/invoices/:invId/payments', ({ params }) => {
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

  http.post('/api/v1/deals/:id/billing/subscriptions/:subId/cancel', async ({ params, request }) => {
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

  http.post('/api/v1/odoo/subscriptions/:subId/cancel', async ({ params, request }) => {
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


  // Alerts Actions: Real Governance Flow for Nudge and Escalate
  http.post('/api/v1/alerts/:id/actions', async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as any;
    const action = (body.action || 'NUDGE').toUpperCase();
    const customMessage = (body.message || '').trim();

    // 1. Locate the alert
    let alert = mockState.alerts.find((a) => a.id === id || a.deal_id === id);
    if (!alert) {
      alert = {
        id,
        deal_id: id.startsWith('deal_') ? id : `deal_${id}`,
        deal_reference: id.toUpperCase(),
        customer_name: 'Customer Account',
        type: 'STALLED_DEAL',
        title: `Deal Alert: ${id}`,
        status: 'OPEN',
        severity: 'MEDIUM',
        health_status: 'WATCH',
        created_at: new Date().toISOString(),
      };
      mockState.alerts.push(alert);
    }

    const authHeader = request.headers.get('Authorization') || '';
    let senderName = 'Sales Management';
    if (authHeader.includes('sales_rep')) {
      senderName = 'Sales Rep One';
    } else if (authHeader.includes('finance')) {
      senderName = 'Finance Director';
    } else if (authHeader.includes('sales_manager')) {
      senderName = 'Sales Manager North';
    } else if (authHeader.includes('admin')) {
      senderName = 'System Administrator';
    }

    // 2. FLOW: NUDGE REP -> Routes to SALES_REP
    if (action === 'NUDGE') {
      alert.status = 'NUDGED' as any;
      alert.last_action = `Nudge dispatched by ${senderName} to Sales Rep (${new Date().toLocaleTimeString()})`;

      const repUserId = 4; // Sales Rep One (owner)
      const notifMsg =
        customMessage ||
        `Management check-in: Please follow up on ${alert.deal_reference} (${alert.customer_name}) regarding ${alert.title}.`;

      // (A) Target Role: SALES_REP notification
      mockState.notifications.unshift({
        id: `notif_nudge_${Date.now()}`,
        recipient_odoo_user_id: repUserId,
        recipient_role: 'SALES_REP',
        type: 'DEAL_NUDGED',
        title: `🔔 Management Nudge: Follow-up required on ${alert.deal_reference}`,
        body: notifMsg,
        entity_type: 'deal',
        entity_id: alert.deal_id,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      // (B) Enqueue urgent action for Sales Rep in Control Tower
      const queueIndex = mockState.controlTower.action_queue.findIndex((q) => q.deal_id === alert?.deal_id);
      const queueItem = {
        kind: 'ALERT' as const,
        id: `queue_nudge_${Date.now()}`,
        deal_id: alert.deal_id,
        reference: alert.deal_reference,
        customer: alert.customer_name,
        title: `[NUDGE: Rep Follow-Up] ${alert.title} — Immediate Rep Outreach Required`,
        severity: 'HIGH' as const,
        priority: 1,
        raised_at: new Date().toISOString(),
        deep_link: `/quotations/${alert.deal_id}`,
      };
      if (queueIndex >= 0) {
        mockState.controlTower.action_queue[queueIndex] = queueItem;
      } else {
        mockState.controlTower.action_queue.unshift(queueItem);
      }

      // (C) Update deal workspace activity history
      const ws = mockState.getOrCreateWorkspace(alert.deal_id);
      if (ws) {
        if (!(ws as any).activities) (ws as any).activities = [];
        (ws as any).activities.unshift({
          id: `act_${Date.now()}`,
          type: 'NUDGE',
          actor: senderName,
          description: `Management dispatched a nudge to Sales Rep: "${notifMsg}"`,
          timestamp: new Date().toISOString(),
        });
      }


      return HttpResponse.json({
        success: true,
        message: `Nudge successfully dispatched to Sales Representative for ${alert.deal_reference}`,
        flow: {
          action: 'NUDGE',
          target_role: 'SALES_REP',
          recipient: 'Sales Rep One (rep1@dealflow.test)',
          deal_reference: alert.deal_reference,
          notification_dispatched: true,
          action_queue_enqueued: true,
        },
      });
    }

    // 3. FLOW: ESCALATE -> Routes to SALES_MANAGER and FINANCE
    if (action === 'ESCALATE') {
      alert.status = 'ESCALATED' as any;
      alert.health_status = 'AT_RISK';
      alert.last_action = `Escalated by ${senderName} to Governance Council (${new Date().toLocaleTimeString()})`;

      const escMsg =
        customMessage ||
        `High-priority escalation on ${alert.deal_reference} (${alert.customer_name}) due to: ${alert.title}. Immediate governance review required.`;

      // (A) Target Roles: SALES_MANAGER and FINANCE notifications
      mockState.notifications.unshift(
        {
          id: `notif_esc_mgr_${Date.now()}`,
          recipient_odoo_user_id: 2, // Sales Manager North
          recipient_role: 'SALES_MANAGER',
          type: 'DEAL_ESCALATED',
          title: `🚨 Governance Escalation: ${alert.deal_reference} (${alert.customer_name})`,
          body: escMsg,
          entity_type: 'deal',
          entity_id: alert.deal_id,
          is_read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: `notif_esc_fin_${Date.now()}`,
          recipient_odoo_user_id: 6, // Finance Director
          recipient_role: 'FINANCE',
          type: 'DEAL_ESCALATED',
          title: `🚨 Commercial Policy Escalation: ${alert.deal_reference}`,
          body: `Finance risk review triggered: ${escMsg}`,
          entity_type: 'deal',
          entity_id: alert.deal_id,
          is_read: false,
          created_at: new Date().toISOString(),
        }
      );

      // (B) Enqueue in Pending Approvals for Sales Manager & Finance
      const existingApprIdx = mockState.approvals.findIndex((a) => a.id === alert?.deal_id);
      const approvalEntry = {
        id: alert.deal_id,
        reference: alert.deal_reference,
        customer: alert.customer_name,
        risk_score: 58.5,
        severity: 'HIGH' as const,
        stage: 'Sales Manager',
        assigned_to: 'Sunita Sales Manager North',
        status: 'PENDING' as const,
        amount: 420000,
        created_at: new Date().toISOString(),
      };
      if (existingApprIdx >= 0) {
        mockState.approvals[existingApprIdx] = {
          ...mockState.approvals[existingApprIdx],
          status: 'PENDING',
          severity: 'HIGH',
        };
      } else {
        mockState.approvals.unshift(approvalEntry);
      }

      // (C) Enqueue top priority item in Control Tower
      const queueIndex = mockState.controlTower.action_queue.findIndex((q) => q.deal_id === alert?.deal_id);
      const queueItem = {
        kind: 'APPROVAL' as const,
        id: `queue_esc_${Date.now()}`,
        deal_id: alert.deal_id,
        reference: alert.deal_reference,
        customer: alert.customer_name,
        title: `[GOVERNANCE ESCALATION] ${alert.title} — Executive Sign-off Required`,
        severity: 'HIGH' as const,
        priority: 1,
        raised_at: new Date().toISOString(),
        deep_link: `/approvals/${alert.deal_id}`,
      };
      if (queueIndex >= 0) {
        mockState.controlTower.action_queue[queueIndex] = queueItem;
      } else {
        mockState.controlTower.action_queue.unshift(queueItem);
      }

      // (D) Update deal workspace approval state
      const ws = mockState.getOrCreateWorkspace(alert.deal_id);
      if (ws) {
        ws.deal.status = 'DRAFT';
        ws.deal.approval_state = 'PENDING_MANAGER';
        ws.deal.required_level = 'MANAGER_AND_FINANCE';
        ws.approval.state = 'PENDING_MANAGER';
        ws.approval.can_decide = true;
        if (!(ws as any).activities) (ws as any).activities = [];
        (ws as any).activities.unshift({
          id: `act_${Date.now()}`,
          type: 'ESCALATE',
          actor: senderName,
          description: `Commercial policy escalation triggered: "${escMsg}"`,
          timestamp: new Date().toISOString(),
        });
      }


      return HttpResponse.json({
        success: true,
        message: `Escalation successfully routed to Sales Manager and Finance for ${alert.deal_reference}`,
        flow: {
          action: 'ESCALATE',
          target_roles: ['SALES_MANAGER', 'FINANCE'],
          recipients: ['Sunita Sales Manager North', 'Vikram Finance Officer'],
          deal_reference: alert.deal_reference,
          approval_queue_enqueued: true,
          notifications_dispatched: true,
        },
      });
    }

    return HttpResponse.json({ message: `Action ${action} processed successfully` });
  }),


  http.post('/api/v1/alerts/:id/acknowledge', ({ params }) => {
    const alert = mockState.alerts.find((a) => a.id === params.id);
    if (alert) alert.status = 'ACKNOWLEDGED';
    return HttpResponse.json({ message: 'Alert acknowledged' });
  }),

  http.post('/api/v1/alerts/:id/resolve', ({ params }) => {
    mockState.alerts = mockState.alerts.filter((a) => a.id !== params.id);
    return HttpResponse.json({ message: 'Alert resolved' });
  }),

  http.get('/api/v1/reports/:type', ({ request, params }) => {
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
  http.get('/api/v1/admin/settings', () => {
    return HttpResponse.json({
      data: {
        manager_threshold: 20,
        finance_threshold: 50,
        single_line_finance_pts: 8,
      },
    });
  }),

  http.put('/api/v1/admin/settings', () => {
    return HttpResponse.json({ message: 'Platform settings saved successfully' });
  }),

  http.get('/api/v1/tiers', () => {
    return HttpResponse.json({
      data: [
        { code: 'GOLD', name: 'Gold Tier', min_spend: 1000000, discount_cap: 25 },
        { code: 'SILVER', name: 'Silver Tier', min_spend: 500000, discount_cap: 18 },
        { code: 'BRONZE', name: 'Bronze Tier', min_spend: 0, discount_cap: 10 },
      ],
    });
  }),

  http.post('/api/v1/tiers', () => {
    return HttpResponse.json({ message: 'Tier saved successfully' });
  }),

  http.get('/api/v1/policies', () => {
    return HttpResponse.json({
      data: [
        { id: 'pol_1', name: 'Standard Margin Floor (15%)', threshold: 15, active: true },
        { id: 'pol_2', name: 'Executive Approval on Over-Discount', threshold: 20, active: true },
      ],
    });
  }),

  http.post('/api/v1/policies', () => {
    return HttpResponse.json({ message: 'Policy saved successfully' });
  }),

  http.post('/api/v1/policies/simulate', () => {
    return HttpResponse.json({
      data: {
        simulated_risk: 28.5,
        required_level: 'MANAGER_ONLY',
        passed: true,
      },
    });
  }),

  http.get('/api/v1/warehouse-profiles', () => {
    return HttpResponse.json({ data: mockState.warehouses });
  }),

  http.post('/api/v1/warehouse-profiles', () => {
    return HttpResponse.json({ message: 'Warehouse profile saved successfully' });
  }),

  http.get('/api/v1/recommendation-rules', () => {
    return HttpResponse.json({
      data: [
        { id: 'rule_1', name: 'Laptop Docking Station Cross-Sell', confidence: 0.85, active: true },
        { id: 'rule_2', name: 'Extended Warranty Upsell', confidence: 0.72, active: true },
      ],
    });
  }),

  http.post('/api/v1/recommendation-rules/mine', () => {
    return HttpResponse.json({ mined_count: 3 });
  }),

  http.get('/api/v1/admin/users', () => {
    return HttpResponse.json({ data: Object.values(mockState.users) });
  }),

  http.get('/api/v1/admin/odoo/health', () => {
    return HttpResponse.json({
      data: {
        status: 'HEALTHY',
        latency_ms: 26,
        version: '18.0 CE',
        connected_db: 'dealflow_odoo_demo',
      },
    });
  }),

  http.get('/api/v1/admin/jobs', () => {
    return HttpResponse.json({
      data: [
        { name: 'daily_health_check', status: 'IDLE', last_run: new Date().toISOString() },
        { name: 'nightly_governance_sync', status: 'IDLE', last_run: new Date().toISOString() },
      ],
    });
  }),

  http.post('/api/v1/admin/jobs/run/:name', () => {
    return HttpResponse.json({ message: 'Background job triggered successfully' });
  }),

  // Customer Portal Additions
  http.post('/api/v1/portal/deals/:id/negotiations/:reqId/withdraw', ({ params }) => {
    const reqId = String(params.reqId);
    mockState.goldenDeal.negotiation.open_requests = mockState.goldenDeal.negotiation.open_requests.filter(
      (r) => r.id !== reqId
    );
    return HttpResponse.json({ message: 'Proposal withdrawn successfully' });
  }),

  http.post('/api/v1/portal/deals/:id/comments', async ({ request }) => {
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

  http.get('/api/v1/portal/deals/:id/billing', () => {
    return HttpResponse.json({ data: mockState.goldenDeal.billing });
  }),

  http.get('/api/v1/portal/deals/:id/revisions', () => {
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

  http.get('/api/v1/portal/notifications', () => {
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

import { INITIAL_GOLDEN_DEAL } from './fixtures/goldenDeal';
import { MOCK_PRODUCTS, MOCK_PARTNERS, MOCK_WAREHOUSES } from './fixtures/products';
import { INITIAL_MOCK_USERS, getStoredUsers, saveStoredUsers, type UserAccountData } from './fixtures/users';
import type { DealWorkspace, ControlTowerData, DealAlertItem, NotificationItem } from '@/api/types';

class MockStateManager {
  public goldenDeal: DealWorkspace = JSON.parse(JSON.stringify(INITIAL_GOLDEN_DEAL));
  public workspaces: Record<string, DealWorkspace> = {};
  public products = [...MOCK_PRODUCTS];
  public partners = [...MOCK_PARTNERS];
  public warehouses = [...MOCK_WAREHOUSES];
  public users: Record<string, UserAccountData> = getStoredUsers();

  public getOrCreateWorkspace(id: string): DealWorkspace {
    if (this.workspaces[id]) {
      return this.workspaces[id];
    }
    if (id === 'deal_d1024_acme') {
      this.workspaces[id] = this.goldenDeal;
      return this.goldenDeal;
    }

    const foundDeal = this.deals.find((d) => d.id === id);
    const foundApproval = this.approvals.find((a) => a.id === id);

    const ws: DealWorkspace = JSON.parse(JSON.stringify(this.goldenDeal));
    ws.deal.id = id;

    if (foundDeal) {
      ws.deal.reference = foundDeal.reference;
      ws.deal.odoo_order_name = foundDeal.odoo_order_name;
      ws.deal.status = (foundDeal.status === 'PENDING_APPROVAL' ? 'DRAFT' : foundDeal.status) as any;
      ws.deal.approval_state = foundDeal.approval_state as any;
      ws.deal.required_level = (foundDeal.required_level === 'MANAGER_ONLY' ? 'MANAGER' : foundDeal.required_level) as any;
      ws.deal.health_status = foundDeal.health_status;
      ws.deal.current_risk_score = foundDeal.current_risk_score;
      ws.deal.current_severity = foundDeal.current_severity;
      ws.deal.amount_total_cache = foundDeal.amount_total_cache;
      ws.customer.name = foundDeal.partner_name_cache;
      ws.customer.partner_id = foundDeal.partner_id;
      ws.risk.score = foundDeal.current_risk_score;
      ws.risk.severity = foundDeal.current_severity;
      ws.approval.state = foundDeal.approval_state as any;
      ws.approval.can_decide =
        foundDeal.approval_state === 'PENDING_MANAGER' ||
        foundDeal.approval_state === 'PENDING_FINANCE';
    } else if (foundApproval) {
      ws.deal.reference = foundApproval.reference;
      ws.customer.name = foundApproval.customer;
      ws.risk.score = foundApproval.risk_score;
      ws.risk.severity = foundApproval.severity;
      ws.approval.state =
        foundApproval.status === 'PENDING'
          ? foundApproval.stage === 'Finance'
            ? 'PENDING_FINANCE'
            : 'PENDING_MANAGER'
          : (foundApproval.status as any);
      ws.deal.approval_state = ws.approval.state;
      ws.deal.status = 'DRAFT';
      ws.approval.can_decide = foundApproval.status === 'PENDING';
    }

    this.workspaces[id] = ws;
    return ws;
  }

  public reloadUsers() {
    this.users = getStoredUsers();
    return this.users;
  }

  public saveUser(key: string, user: UserAccountData) {
    this.users[key] = user;
    saveStoredUsers(this.users);
  }

  public removeUser(key: string) {
    delete this.users[key];
    saveStoredUsers(this.users);
  }

  public controlTower: ControlTowerData = {
    kpis: {
      pipeline_value: 1850000,
      at_risk_count: 2,
      pending_approvals: 3,
      discount_exposure_amount: 98000,
      stalled_count: 1,
      avg_approval_hours: 6.4,
      fulfillment_risk_count: 1,
    },
    action_queue: [
      {
        kind: 'APPROVAL',
        id: 'queue_1',
        deal_id: 'deal_d1024_acme',
        reference: 'D-1024',
        customer: 'Acme Corp',
        title: 'High Risk (56) Quotation requires Manager Approval',
        severity: 'HIGH',
        priority: 1,
        raised_at: new Date(Date.now() - 3600000).toISOString(),
        deep_link: '/approvals/deal_d1024_acme',
      },
      {
        kind: 'APPROVAL',
        id: 'queue_2',
        deal_id: 'deal_d1023_beta',
        reference: 'D-1023',
        customer: 'Beta Industries',
        title: 'Discount Anomaly (22%) requires Manager Approval',
        severity: 'HIGH',
        priority: 2,
        raised_at: new Date(Date.now() - 7200000).toISOString(),
        deep_link: '/approvals/deal_d1023_beta',
      },
      {
        kind: 'APPROVAL',
        id: 'queue_3',
        deal_id: 'deal_d1021_delta',
        reference: 'D-1021',
        customer: 'Delta Systems Inc',
        title: 'High Order Value (₹7,80,000) requires Finance Approval',
        severity: 'MEDIUM',
        priority: 3,
        raised_at: new Date(Date.now() - 14400000).toISOString(),
        deep_link: '/approvals/deal_d1021_delta',
      },
      {
        kind: 'ALERT',
        id: 'queue_4',
        deal_id: 'deal_d1022_gamma',
        reference: 'D-1022',
        customer: 'Gamma LLC',
        title: 'Quotation Stalled for 12 days without customer response',
        severity: 'MEDIUM',
        priority: 4,
        raised_at: new Date(Date.now() - 12 * 86400000).toISOString(),
        deep_link: '/deal-health',
      },
    ],
  };

  public approvals = [
    {
      id: 'deal_d1024_acme',
      reference: 'D-1024',
      customer: 'Acme Corp',
      risk_score: 56.0,
      severity: 'HIGH' as const,
      stage: 'Sales Manager',
      assigned_to: 'Sunita Sales Manager North',
      status: 'PENDING' as const,
      amount: 558000,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'deal_d1023_beta',
      reference: 'D-1023',
      customer: 'Beta Industries',
      risk_score: 29.7,
      severity: 'MEDIUM' as const,
      stage: 'Sales Manager',
      assigned_to: 'Sales Manager South',
      status: 'PENDING' as const,
      amount: 420000,
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'deal_d1021_delta',
      reference: 'D-1021',
      customer: 'Delta Systems Inc',
      risk_score: 44.5,
      severity: 'MEDIUM' as const,
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'PENDING' as const,
      amount: 780000,
      created_at: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      id: 'deal_d1019_gamma',
      reference: 'D-1019',
      customer: 'Gamma LLC',
      risk_score: 38.0,
      severity: 'MEDIUM' as const,
      stage: 'Sales Manager',
      assigned_to: 'Sales Rep One',
      status: 'RETURNED' as const,
      amount: 310000,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'deal_d1018_zeta',
      reference: 'D-1018',
      customer: 'Zeta Tech',
      risk_score: 14.2,
      severity: 'LOW' as const,
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'APPROVED' as const,
      amount: 450000,
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'deal_d1015_omega',
      reference: 'D-1015',
      customer: 'Omega Global',
      risk_score: 18.0,
      severity: 'LOW' as const,
      stage: 'Sales Manager',
      assigned_to: 'Sunita Sales Manager North',
      status: 'APPROVED' as const,
      amount: 280000,
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'deal_d1012_alpha',
      reference: 'D-1012',
      customer: 'Alpha Logistics',
      risk_score: 22.5,
      severity: 'LOW' as const,
      stage: 'Sales Manager',
      assigned_to: 'Sunita Sales Manager North',
      status: 'APPROVED' as const,
      amount: 360000,
      created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      id: 'deal_d1009_theta',
      reference: 'D-1009',
      customer: 'Theta Systems',
      risk_score: 16.0,
      severity: 'LOW' as const,
      stage: 'Sales Manager',
      assigned_to: 'Sales Manager South',
      status: 'APPROVED' as const,
      amount: 190000,
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: 'deal_d1004_sigma',
      reference: 'D-1004',
      customer: 'Sigma Retail',
      risk_score: 11.5,
      severity: 'LOW' as const,
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'APPROVED' as const,
      amount: 520000,
      created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    },
  ];

  public deals = [
    {
      id: 'deal_d1024_acme',
      reference: 'D-1024',
      odoo_order_name: 'SO-2026-012',
      partner_name_cache: 'Acme Corp',
      partner_id: 1,
      status: 'PENDING_APPROVAL',
      approval_state: 'PENDING_MANAGER',
      required_level: 'MANAGER_AND_FINANCE',
      health_status: 'HEALTHY' as const,
      current_risk_score: 56.0,
      current_severity: 'HIGH' as const,
      currency_code: 'INR',
      amount_total_cache: 558000,
      last_activity_at: new Date(Date.now() - 3600000).toISOString(),
      owner: { id: 4, name: 'Sales Rep One' },
      version: 1,
    },
    {
      id: 'deal_d1023_beta',
      reference: 'D-1023',
      odoo_order_name: 'SO-2026-011',
      partner_name_cache: 'Beta Industries',
      partner_id: 2,
      status: 'PENDING_APPROVAL',
      approval_state: 'PENDING_MANAGER',
      required_level: 'MANAGER_ONLY',
      health_status: 'AT_RISK' as const,
      current_risk_score: 29.7,
      current_severity: 'MEDIUM' as const,
      currency_code: 'INR',
      amount_total_cache: 420000,
      last_activity_at: new Date(Date.now() - 7200000).toISOString(),
      owner: { id: 4, name: 'Sales Rep One' },
      version: 1,
    },
    {
      id: 'deal_d1021_delta',
      reference: 'D-1021',
      odoo_order_name: 'SO-2026-009',
      partner_name_cache: 'Delta Systems Inc',
      partner_id: 3,
      status: 'PENDING_APPROVAL',
      approval_state: 'PENDING_FINANCE',
      required_level: 'FINANCE_ONLY',
      health_status: 'HEALTHY' as const,
      current_risk_score: 44.5,
      current_severity: 'MEDIUM' as const,
      currency_code: 'INR',
      amount_total_cache: 780000,
      last_activity_at: new Date(Date.now() - 14400000).toISOString(),
      owner: { id: 4, name: 'Sales Rep One' },
      version: 1,
    },
    {
      id: 'deal_d1022_gamma',
      reference: 'D-1022',
      odoo_order_name: 'SO-2026-010',
      partner_name_cache: 'Gamma LLC',
      partner_id: 4,
      status: 'DRAFT',
      approval_state: 'DRAFT',
      required_level: 'REP_ONLY',
      health_status: 'WATCH' as const,
      current_risk_score: 24.0,
      current_severity: 'LOW' as const,
      currency_code: 'INR',
      amount_total_cache: 92000,
      last_activity_at: new Date(Date.now() - 12 * 86400000).toISOString(),
      owner: { id: 4, name: 'Sales Rep One' },
      version: 1,
    },
  ];

  public invoices = [
    {
      id: 1042,
      number: 'INV-1042',
      customer: 'Acme Corp',
      deal_id: 'deal_d1024_acme',
      amount: 558000,
      status: 'Unpaid',
      due_date: '2026-10-05',
    },
    {
      id: 1043,
      number: 'INV-1043',
      customer: 'Beta Industries',
      deal_id: 'deal_d1023_beta',
      amount: 420000,
      status: 'Paid',
      due_date: '2026-09-01',
    },
  ];

  public subscriptions = [
    {
      id: 101,
      customer: 'Acme Corp',
      deal_id: 'deal_d1024_acme',
      plan: 'Monthly Gold Support',
      cycle: 'Monthly',
      next_bill: '2026-10-01',
      status: 'Active',
    },
    {
      id: 102,
      customer: 'Beta Industries',
      deal_id: 'deal_d1023_beta',
      plan: 'Enterprise SLA Tier 1',
      cycle: 'Quarterly',
      next_bill: '2026-11-01',
      status: 'Active',
    },
  ];

  public fulfillmentExceptions = [
    {
      id: 'exc_1',
      deal_id: 'deal_d1024_acme',
      reference: 'D-1024',
      customer: 'Acme Corp',
      type: 'SPLIT_FULFILLMENT',
      status: 'OPEN',
      description: 'Multi-warehouse split allocation: Main WH (8) + East Depot (2)',
      severity: 'MEDIUM',
    },
  ];

  public alerts: DealAlertItem[] = [
    {
      id: 'alert_1',
      deal_id: 'deal_d1022_gamma',
      deal_reference: 'D-1022',
      customer_name: 'Gamma LLC',
      type: 'STALLED_DEAL',
      title: 'Stalled Deal: Idle for 12 days',
      status: 'OPEN',
      severity: 'MEDIUM',
      health_status: 'WATCH',
      created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
    {
      id: 'alert_2',
      deal_id: 'deal_d1023_beta',
      deal_reference: 'D-1023',
      customer_name: 'Beta Industries',
      type: 'DISCOUNT_ANOMALY',
      title: 'Discount Anomaly: 22% given vs rep baseline 8%',
      status: 'OPEN',
      severity: 'HIGH',
      health_status: 'AT_RISK',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];

  public notifications: NotificationItem[] = [
    {
      id: 'notif_1',
      recipient_odoo_user_id: 4,
      type: 'DEAL_EVALUATED',
      title: 'Quotation D-1024 Flagged',
      body: 'Deal Guardian scored D-1024 at 56 (HIGH). Manager approval required.',
      entity_type: 'deal',
      entity_id: 'deal_d1024_acme',
      is_read: false,
      created_at: new Date().toISOString(),
    },
  ];

  public outbox = [
    {
      id: 'outbox_1',
      recipient: 'buyer@acme.test',
      subject: 'Your DealFlow360 Quotation Magic Link',
      token: 'magic_token_acme_buyer_123',
      created_at: new Date().toISOString(),
    },
  ];

  public reset() {
    this.goldenDeal = JSON.parse(JSON.stringify(INITIAL_GOLDEN_DEAL));
    this.workspaces = { deal_d1024_acme: this.goldenDeal };
    this.users = JSON.parse(JSON.stringify(INITIAL_MOCK_USERS));
    saveStoredUsers(this.users);
  }
}

export const mockState = new MockStateManager();

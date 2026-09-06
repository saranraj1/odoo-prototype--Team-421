import { INITIAL_GOLDEN_DEAL } from './fixtures/goldenDeal';
import { MOCK_PRODUCTS, MOCK_PARTNERS, MOCK_WAREHOUSES } from './fixtures/products';
import { INITIAL_MOCK_USERS, getStoredUsers, saveStoredUsers, type UserAccountData } from './fixtures/users';
import { REALISTIC_DEALS_160, REALISTIC_APPROVALS_160, REALISTIC_ALERTS_160 } from './fixtures/realisticDeals160';
import type { DealWorkspace, ControlTowerData, DealAlertItem, NotificationItem } from '@/api/types';

import { createRealisticWorkspace, recomputeWorkspace } from './dealWorkspaceFactory';


export const SYNC_CHANNEL_NAME = 'dealflow360_cross_tab_sync';

export function broadcastStateChange(entity: 'deals' | 'approvals' | 'workspaces' | 'users' | 'invoices') {
  if (typeof window === 'undefined') return;
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.postMessage({ type: 'SYNC_STATE', entity, timestamp: Date.now() });
      bc.close();
    }
    window.dispatchEvent(new CustomEvent('dealflow_sync', { detail: { entity } }));
  } catch {}
}

const STORAGE_WORKSPACES_KEY = 'dealflow_mock_workspaces_v4';
const STORAGE_DEALS_KEY = 'dealflow_mock_deals_v4';
const STORAGE_APPROVALS_KEY = 'dealflow_mock_approvals_v4';

function getStoredWorkspaces(): Record<string, DealWorkspace> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_WORKSPACES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveStoredWorkspaces(workspaces: Record<string, DealWorkspace>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_WORKSPACES_KEY, JSON.stringify(workspaces));
    broadcastStateChange('workspaces');
  } catch {}
}

function getStoredDeals(fallback: any[]): any[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_DEALS_KEY);
    let deals = raw ? JSON.parse(raw) : [...fallback];
    // Cross-heal: if any workspace in storage was marked CONFIRMED, synchronize deals list
    const rawWs = localStorage.getItem(STORAGE_WORKSPACES_KEY);
    if (rawWs) {
      try {
        const workspaces = JSON.parse(rawWs);
        Object.values(workspaces).forEach((ws: any) => {
          if (ws?.deal?.id && ws?.deal?.status === 'CONFIRMED') {
            const match = deals.find((d: any) => d.id === ws.deal.id);
            if (match && match.status !== 'CONFIRMED') {
              match.status = 'CONFIRMED';
              match.approval_state = 'APPROVED';
            }
          }
        });
      } catch {}
    }
    return deals;
  } catch {}
  return fallback;
}

function saveStoredDeals(deals: any[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_DEALS_KEY, JSON.stringify(deals));
    broadcastStateChange('deals');
  } catch {}
}

function getStoredApprovals(fallback: any[]): any[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_APPROVALS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function saveStoredApprovals(approvals: any[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_APPROVALS_KEY, JSON.stringify(approvals));
    broadcastStateChange('approvals');
  } catch {}
}

const STORAGE_INVOICES_KEY = 'dealflow_mock_invoices_v4';

function getStoredInvoices(fallback: any[]): any[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_INVOICES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function saveStoredInvoices(invoices: any[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_INVOICES_KEY, JSON.stringify(invoices));
    broadcastStateChange('invoices' as any);
  } catch {}
}

class MockStateManager {
  public invalidateMemoryCache(entity?: string) {
    if (!entity || entity === 'deals') {
      this._deals = null;
    }
    if (!entity || entity === 'approvals') {
      this._approvals = null;
    }
    if (!entity || entity === 'workspaces') {
      this._workspaces = null;
    }
    if (!entity || entity === 'invoices') {
      this._invoices = null;
    }
  }

  public goldenDeal: DealWorkspace = JSON.parse(JSON.stringify(INITIAL_GOLDEN_DEAL));
  private _workspaces: Record<string, DealWorkspace> | null = null;
  public get workspaces(): Record<string, DealWorkspace> {
    if (!this._workspaces) {
      this._workspaces = getStoredWorkspaces();
    }
    return this._workspaces;
  }
  public set workspaces(val: Record<string, DealWorkspace>) {
    this._workspaces = val;
    saveStoredWorkspaces(val);
  }

  public saveWorkspace(id: string, ws: DealWorkspace) {
    const current = this.workspaces;
    current[id] = ws;
    this.workspaces = current;
    saveStoredWorkspaces(current);
  }

  public products = [...MOCK_PRODUCTS];
  public partners = [...MOCK_PARTNERS];
  public warehouses = [...MOCK_WAREHOUSES];
  public get users(): Record<string, UserAccountData> {
    return getStoredUsers();
  }
  public set users(val: Record<string, UserAccountData>) {
    saveStoredUsers(val);
  }

  public saveUser(key: string, user: UserAccountData) {
    const current = getStoredUsers();
    current[key] = user;
    saveStoredUsers(current);
  }

  public removeUser(key: string) {
    const current = getStoredUsers();
    delete current[key];
    saveStoredUsers(current);
  }

  public recomputeWorkspace(ws: DealWorkspace): DealWorkspace {
    return recomputeWorkspace(ws);
  }

  public getOrCreateWorkspace(id: string): DealWorkspace {
    const stored = this.workspaces;
    if (stored[id]) {
      return stored[id];
    }
    if (id === 'deal_d1024_acme') {
      this.saveWorkspace(id, this.goldenDeal);
      return this.goldenDeal;
    }

    const ws = createRealisticWorkspace(id, this.deals, this.approvals, this.goldenDeal);
    this.saveWorkspace(id, ws);
    return ws;
  }

  public reloadUsers() {
    this.users = getStoredUsers();
    return this.users;
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

  private _approvals: any[] | null = null;
  public saveApprovals() {
    saveStoredApprovals(this.approvals);
  }
  public get approvals(): any[] {
    if (!this._approvals) {
      this._approvals = getStoredApprovals(MockStateManager.rawApprovals);
    }
    return this._approvals;
  }
  public set approvals(val: any[]) {
    this._approvals = val;
    saveStoredApprovals(val);
  }
  public static rawApprovals = [
    {
      id: 'deal_d1022_gamma',
      reference: 'D-1022',
      customer: 'Gamma LLC',
      risk_score: 7.0,
      severity: 'LOW' as const,
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'APPROVED' as const,
      amount: 1968948,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
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
    {
      id: 'deal_d1031_nexus',
      reference: 'D-1031',
      customer: 'Nexus Pharma Ltd',
      risk_score: 52.0,
      severity: 'HIGH' as const,
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'PENDING' as const,
      amount: 1250000,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'deal_d1028_vertex',
      reference: 'D-1028',
      customer: 'Vertex Technologies',
      risk_score: 34.5,
      severity: 'MEDIUM' as const,
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'PENDING' as const,
      amount: 870000,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'deal_d1026_prism',
      reference: 'D-1026',
      customer: 'Prism Analytics',
      risk_score: 19.0,
      severity: 'LOW' as const,
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'APPROVED' as const,
      amount: 480000,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    ...REALISTIC_APPROVALS_160,
  ];

  private _deals: any[] | null = null;
  public saveDeals() {
    saveStoredDeals(this.deals);
  }
  public get deals(): any[] {
    if (!this._deals) {
      this._deals = getStoredDeals(MockStateManager.rawDeals);
    }
    return this._deals;
  }
  public set deals(val: any[]) {
    this._deals = val;
    saveStoredDeals(val);
  }
  public static rawDeals = [
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
      approval_state: 'APPROVED',
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
    ...REALISTIC_DEALS_160,
  ];

  private _invoices: any[] | null = null;
  public saveInvoices() {
    saveStoredInvoices(this.invoices);
  }
  public get invoices(): any[] {
    if (!this._invoices) {
      this._invoices = getStoredInvoices(MockStateManager.rawInvoices);
    }
    return this._invoices;
  }
  public set invoices(val: any[]) {
    this._invoices = val;
    saveStoredInvoices(val);
  }
  public static rawInvoices = [
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
    ...REALISTIC_ALERTS_160,
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

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      const listenBc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      listenBc.onmessage = (event) => {
        const entity = event.data?.entity;
        mockState.invalidateMemoryCache(entity);
        window.dispatchEvent(new CustomEvent('dealflow_sync', { detail: event.data }));
      };
    }
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_DEALS_KEY) mockState.invalidateMemoryCache('deals');
      if (e.key === STORAGE_APPROVALS_KEY) mockState.invalidateMemoryCache('approvals');
      if (e.key === STORAGE_WORKSPACES_KEY) mockState.invalidateMemoryCache('workspaces');
      if (e.key === STORAGE_INVOICES_KEY) mockState.invalidateMemoryCache('invoices');
      window.dispatchEvent(new CustomEvent('dealflow_sync', { detail: { entity: 'storage' } }));
    });
  } catch {}
}

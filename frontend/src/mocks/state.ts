import { INITIAL_GOLDEN_DEAL } from './fixtures/goldenDeal';
import { MOCK_PRODUCTS, MOCK_PARTNERS, MOCK_WAREHOUSES } from './fixtures/products';
import { INITIAL_MOCK_USERS, getStoredUsers, saveStoredUsers, type UserAccountData } from './fixtures/users';
import type { DealWorkspace, ControlTowerData, DealAlertItem } from '@/api/types';

class MockStateManager {
  public goldenDeal: DealWorkspace = JSON.parse(JSON.stringify(INITIAL_GOLDEN_DEAL));
  public products = [...MOCK_PRODUCTS];
  public partners = [...MOCK_PARTNERS];
  public warehouses = [...MOCK_WAREHOUSES];
  public users: Record<string, UserAccountData> = getStoredUsers();

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
        raised_at: new Date().toISOString(),
        deep_link: '/approvals/deal_d1024_acme',
      },
      {
        kind: 'ALERT',
        id: 'queue_2',
        deal_id: 'deal_d1022_gamma',
        reference: 'D-1022',
        customer: 'Gamma LLC',
        title: 'Quotation Stalled for 12 days without customer response',
        severity: 'MEDIUM',
        priority: 2,
        raised_at: new Date().toISOString(),
        deep_link: '/deal-health',
      },
    ],
  };

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

  public notifications = [
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
    this.users = JSON.parse(JSON.stringify(INITIAL_MOCK_USERS));
    saveStoredUsers(this.users);
  }
}

export const mockState = new MockStateManager();

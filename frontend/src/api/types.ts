export type DealStatus = 
  | 'DRAFT' 
  | 'SENT' 
  | 'UNDER_NEGOTIATION' 
  | 'CONFIRMED' 
  | 'IN_FULFILLMENT' 
  | 'FULFILLED' 
  | 'INVOICED' 
  | 'PAID' 
  | 'CANCELLED' 
  | 'EXPIRED';

export type ApprovalState = 
  | 'NOT_EVALUATED' 
  | 'EVALUATED_NO_APPROVAL' 
  | 'PENDING_MANAGER' 
  | 'PENDING_FINANCE' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'RETURNED' 
  | 'INVALIDATED';

export type ApprovalLevel = 'NONE' | 'MANAGER' | 'MANAGER_AND_FINANCE';

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type HealthStatus = 'HEALTHY' | 'WATCH' | 'AT_RISK';

export type RiskFactorType = 
  | 'DISCOUNT_EXCESS' 
  | 'MARGIN_EXPOSURE' 
  | 'INVENTORY_RISK' 
  | 'APPROVAL_DELAY' 
  | 'NEGOTIATION_PRESSURE';

export type NegotiationRequestType = 
  | 'COMMENT' 
  | 'QTY_CHANGE' 
  | 'REMOVE_LINE' 
  | 'ADD_LINE' 
  | 'COUNTER_DISCOUNT';

export type NegotiationStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'WITHDRAWN';

export type FulfillmentPlanStatus = 
  | 'PROPOSED' 
  | 'ACCEPTED' 
  | 'OVERRIDDEN' 
  | 'APPLIED' 
  | 'SUPERSEDED' 
  | 'CANCELLED';

export type RecommendationStatus = 'ACTIVE' | 'ADDED' | 'DISMISSED' | 'EXPIRED';

export type AlertType = 
  | 'STALLED_DEAL' 
  | 'DISCOUNT_ANOMALY' 
  | 'DELIVERY_SLIPPAGE' 
  | 'APPROVAL_DELAY';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type NextBestActionType = 
  | 'FINANCE_APPROVAL_REQUIRED' 
  | 'MANAGER_APPROVAL_REQUIRED' 
  | 'REDUCE_DISCOUNT' 
  | 'RESTORE_MARGIN' 
  | 'REAPPROVAL_REQUIRED' 
  | 'RESPOND_TO_CUSTOMER' 
  | 'ACCEPT_FULFILLMENT_PLAN' 
  | 'CONSOLIDATE_BACKORDER' 
  | 'ADD_RECOMMENDATION' 
  | 'SEND_TO_CUSTOMER' 
  | 'FOLLOW_UP_CUSTOMER' 
  | 'CONFIRM_ORDER' 
  | 'AWAITING_APPROVER' 
  | 'NONE';

export type PortalStatus = 'SENT' | 'UNDER_NEGOTIATION' | 'UNDER_REVIEW' | 'CONFIRMED' | 'CLOSED';

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface AuthUser {
  id: number;
  odoo_user_id: number;
  name: string;
  role: 'ADMIN' | 'SALES_MANAGER' | 'SALES_REP' | 'FINANCE' | 'FINANCE_DIRECTOR' | 'CUSTOMER';
  team_id?: number | null;
  company_id: number;
  email?: string;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export interface PortalAuthResponse {
  access_token: string;
  token_type: string;
  partner: {
    id: number;
    name: string;
    email?: string;
  };
}

export interface DealLine {
  odoo_line_id: number;
  product_id: number;
  product_name: string;
  category_name?: string;
  product_type?: string;
  qty: number;
  price_unit: number;
  discount_pct: number;
  effective_discount_pct: number;
  ceiling_pct: number;
  overage_pts: number;
  unit_cost: number;
  net_value: number;
  margin: number;
  is_recurring: boolean;
  plan_name?: string | null;
}

export interface QuoteTotals {
  list: number;
  net: number;
  tax: number;
  total: number;
  margin_amount: number;
  margin_pct: number;
  one_time: number;
  recurring_first_cycle: number;
}

export interface RiskFactor {
  factor_type: RiskFactorType;
  source_reference?: string;
  contribution: number;
  reason: string;
  detail?: any;
}

export interface DealRisk {
  score: number;
  severity: RiskSeverity;
  required_level: ApprovalLevel;
  factors: RiskFactor[];
  assessment_id: string;
  calculated_at: string;
  previous_score?: number | null;
}

export interface ApprovalAction {
  id: string;
  request_id?: string;
  actor_name: string;
  actor_role: string;
  action: string;
  reason?: string;
  created_at: string;
}

export interface ApprovalRequestItem {
  id: string;
  sequence: number;
  required_level: ApprovalLevel;
  status: string;
  requested_at: string;
  completed_at?: string;
  decided_by_name?: string;
}

export interface DealApproval {
  state: ApprovalState;
  required: boolean;
  level: ApprovalLevel;
  requests: ApprovalRequestItem[];
  actions: ApprovalAction[];
  can_decide: boolean;
}

export interface DealHealth {
  status: HealthStatus;
  score: number;
  components: {
    stalled_score?: number;
    approval_delay_score?: number;
    discount_anomaly_score?: number;
    delivery_risk_score?: number;
    negotiation_score?: number;
  };
}

export interface DealRecommendation {
  id: string;
  product_name: string;
  recommendation_type: string;
  score: number;
  margin_delta_amount: number;
  margin_delta_pct: number;
  unit_price_cache: number;
  reason: string;
  is_promoted: boolean;
  status: RecommendationStatus;
}

export interface FulfillmentPlanLine {
  odoo_sale_order_line_id: number;
  product_name: string;
  odoo_warehouse_id: number;
  warehouse_name: string;
  requested_qty: number;
  allocated_qty: number;
  backorder_qty: number;
  shipping_cost: number;
}

export interface FulfillmentPlan {
  id: string;
  status: FulfillmentPlanStatus;
  strategy: string;
  estimated_shipments: number;
  estimated_shipping_cost: number;
  algorithm_notes?: string;
  lines: FulfillmentPlanLine[];
}

export interface PickingItem {
  id: number;
  name: string;
  warehouse_name: string;
  state: string;
  scheduled_date?: string;
  date_done?: string;
  promised_date?: string;
  is_late: boolean;
}

export interface DealFulfillment {
  plan: FulfillmentPlan | null;
  pickings: PickingItem[];
  backorders: any[];
  consolidatable: boolean;
}

export interface InvoiceItem {
  id: number;
  number: string;
  type: string;
  status: string;
  amount_total: number;
  amount_due: number;
  due_date?: string;
}

export interface SubscriptionItem {
  id: number;
  product_name: string;
  plan_name: string;
  cadence: string;
  status: string;
  next_billing_date?: string;
  schedule: Array<{
    period_start: string;
    period_end: string;
    due_date: string;
    amount: number;
    status: string;
  }>;
}

export interface DealBilling {
  one_time_lines: any[];
  recurring_lines: Array<{
    product_name: string;
    plan_name: string;
    cadence: string;
    next_bill_date?: string;
    amount: number;
  }>;
  invoices: InvoiceItem[];
  payments: any[];
  subscriptions: SubscriptionItem[];
}

export interface NegotiationRequest {
  id: string;
  type: NegotiationRequestType;
  status: NegotiationStatus;
  line_id?: number | null;
  line_name?: string;
  message?: string;
  requested_value?: number;
  created_at: string;
}

export interface NegotiationComment {
  id: string;
  line_id?: number | null;
  author_name: string;
  author_role: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface DealNegotiation {
  open_requests: NegotiationRequest[];
  comments: NegotiationComment[];
}

export interface NextBestAction {
  type: NextBestActionType;
  priority: number;
  title: string;
  explanation: string;
  payload?: any;
  cta_endpoint?: string;
}

export interface TimelineEvent {
  id: string;
  event_type: string;
  actor_name: string;
  actor_role: string;
  reason?: string;
  created_at: string;
  summary?: string;
}

export interface DealWorkspace {
  deal: {
    id: string;
    reference: string;
    odoo_order_name: string;
    status: DealStatus;
    approval_state: ApprovalState;
    required_level: ApprovalLevel;
    health_status: HealthStatus;
    current_risk_score: number;
    current_severity: RiskSeverity;
    currency_code: string;
    order_discount_pct: number;
    amount_total?: number;
    amount_total_cache?: number;
    customer_confirmed_pending: boolean;
    sent_at?: string | null;
    confirmed_at?: string | null;
    promised_delivery_date?: string | null;
    last_activity_at: string;
    owner: { id: number; name: string };
    version: number;
  };
  customer: {
    partner_id: number;
    name: string;
    tier_code?: string;
    payment_term_days: number;
  };
  quote: {
    lines: DealLine[];
    totals: QuoteTotals;
  };
  risk: DealRisk;
  approval: DealApproval;
  health: DealHealth;
  recommendations: DealRecommendation[];
  fulfillment: DealFulfillment;
  billing: DealBilling;
  negotiation: DealNegotiation;
  next_best_action: NextBestAction;
  timeline: TimelineEvent[];
}

export interface ControlTowerKpis {
  pipeline_value: number;
  at_risk_count: number;
  pending_approvals: number;
  discount_exposure_amount: number;
  stalled_count: number;
  avg_approval_hours: number;
  fulfillment_risk_count: number;
}

export interface ActionQueueItem {
  kind: 'ALERT' | 'APPROVAL';
  id: string;
  deal_id: string;
  reference: string;
  customer: string;
  title: string;
  severity?: RiskSeverity;
  priority?: number;
  raised_at: string;
  deep_link: string;
}

export interface ControlTowerData {
  kpis: ControlTowerKpis;
  action_queue: ActionQueueItem[];
}

export interface DealAlertItem {
  id: string;
  deal_id: string;
  deal_reference: string;
  customer_name: string;
  type: AlertType;
  title: string;
  status: AlertStatus;
  severity: RiskSeverity;
  created_at: string;
  last_action?: string;
  health_status: HealthStatus;
}

export interface NotificationItem {
  id: string;
  recipient_odoo_user_id: number;
  type: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}


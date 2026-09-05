export type CustomerTier = 'GOLD' | 'SILVER' | 'BRONZE';

export type ProductCategory = 'HARDWARE' | 'SOFTWARE' | 'SERVICES' | 'SUBSCRIPTION';

export type DealState = 
  | 'DRAFT'
  | 'PENDING_MANAGER'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'REJECTED'
  | 'INVALIDATED'
  | 'CONFIRMED';

export type UserRole = 
  | 'SALES_REP' 
  | 'SALES_MANAGER' 
  | 'FINANCE_DIRECTOR' 
  | 'ADMIN'
  | 'CUSTOMER';

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  assignmentStatus: 'ASSIGNED' | 'PENDING';
  assignedDeals?: string[];
  customerId?: string; // For B2B customers
  passwordHash: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  code: string;
  tier: CustomerTier;
  maxDiscount: number;
  paymentTerms: string;
  historicalSpend: number;
  assignedRepId: string;
  assignedRepName: string;
  classifiedBy: string;
  classifiedAt: string;
  notes?: string;
}

export interface LineItem {
  id: string;
  productId: string;
  name: string;
  category: ProductCategory;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discountPercent: number;
  requestedDiscountPercent?: number;
  isSubscription?: boolean;
  billingPeriod?: 'MONTHLY' | 'ANNUAL' | 'ONE_TIME';
  notes?: string;
}

export interface ApprovedBaseline {
  capturedAt: string;
  approvedBy: string;
  role: 'SALES_MANAGER' | 'FINANCE_DIRECTOR';
  netTotal: number;
  marginPercent: number;
  lines: Array<{
    lineId: string;
    productId: string;
    quantity: number;
    discountPercent: number;
    unitPrice: number;
  }>;
}

export interface DealContext {
  id: string;
  dealNumber: string;
  odooOrderId: string;
  title: string;
  customerId: string;
  customerName: string;
  customerTier: CustomerTier;
  paymentTerms: string;
  historicalSpend: number;
  currency: string;
  salesRepId: string;
  salesRepName: string;
  state: DealState;
  version: number;
  createdAt: string;
  lastActivityDate: string;
  lines: LineItem[];
  approvedBaseline: ApprovedBaseline | null;
  customerNotes?: string;
  internalNotes?: string;
  negotiationActive?: boolean;
}

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  id: string;
  category: 'DISCOUNT_EXCESS' | 'MARGIN_EROSION' | 'STOCK_FRAGMENTATION' | 'DEAL_DELAY' | 'COUNTEROFFER_DRIFT';
  name: string;
  scoreImpact: number;
  explanation: string;
  violatingLineId?: string;
}

export interface NextBestAction {
  actionType: string;
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
  buttonLabel: string;
  targetAction: string;
}

export interface GuardianEvaluationResult {
  dealId: string;
  dealVersion: number;
  blendedRiskScore: number; // 0 - 100
  severity: RiskSeverity;
  dealHealth: 'HEALTHY' | 'WATCH' | 'AT_RISK';
  factors: RiskFactor[];
  requiredApprovalRole: 'NONE' | 'SALES_MANAGER' | 'FINANCE_DIRECTOR';
  policyCeilingBreached: boolean;
  tierCeilingBreached?: boolean;
  tierViolationMessage?: string;
  subtotal: number;
  discountTotal: number;
  netTotal: number;
  totalCost: number;
  grossMarginAmount: number;
  marginPercent: number;
  nextBestAction: NextBestAction;
  evaluatedAt: string;
}

export interface AccretiveRecommendation {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  unitPrice: number;
  costPrice: number;
  projectedMarginAmount: number;
  projectedMarginPercent: number;
  coPurchaseAffinity: number; // 0 - 100
  rationale: string;
  recommendedQty: number;
}

export interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  locationCode: string;
  availableQty: Record<string, number>;
}

export interface AllocationLine {
  productId: string;
  productName: string;
  requestedQty: number;
  allocatedFromMain: number;
  allocatedFromEast: number;
  backorderQty: number;
}

export interface FulfillmentPlan {
  dealId: string;
  status: 'OPTIMAL' | 'SPLIT_REQUIRED' | 'BACKORDER_REQUIRED';
  shipmentCount: number;
  estimatedShippingCost: number;
  lines: AllocationLine[];
  isManuallyOverridden: boolean;
  acceptedAt?: string;
}

export interface AuditTimelineItem {
  id: string;
  dealId: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  eventType: 'CREATED' | 'DISCOUNT_UPDATED' | 'RISK_EVALUATED' | 'APPROVAL_REQUESTED' | 'APPROVED' | 'REJECTED' | 'COUNTEROFFER_RECEIVED' | 'APPROVAL_INVALIDATED' | 'ORDER_CONFIRMED' | 'TIER_CHANGED' | 'WORK_ASSIGNED';
  summary: string;
  details?: string;
  badgeVariant: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

export interface NegotiationProposal {
  id: string;
  dealId: string;
  customerName: string;
  status: 'SENT' | 'UNDER_NEGOTIATION' | 'UNDER_REVIEW' | 'UPDATED_QUOTE' | 'CONFIRMED';
  submittedAt: string;
  comments: string;
  proposedChanges: Array<{
    lineId: string;
    productName: string;
    currentDiscount: number;
    proposedDiscount: number;
    impactLabel: string;
  }>;
}

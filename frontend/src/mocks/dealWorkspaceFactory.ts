import type {
  DealWorkspace,
  DealLine,
  QuoteTotals,
  DealRisk,
  DealApproval,
  DealHealth,
  RecommendationItem,
  TimelineEvent,
  NextBestAction,
  DealListItem,
  ApprovalInboxItem,
} from '@/api/types';

export interface CatalogProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  cost: number;
  ceiling: number;
  is_recurring: boolean;
  plan_name?: string;
}

export const RICH_PRODUCT_CATALOG: CatalogProduct[] = [
  { id: 101, name: 'Enterprise Laptop Pro 14"', category: 'Hardware', price: 125000, cost: 92000, ceiling: 15, is_recurring: false },
  { id: 102, name: 'UltraBook Executive 13"', category: 'Hardware', price: 95000, cost: 71000, ceiling: 15, is_recurring: false },
  { id: 103, name: 'Cloud Rack Server X1', category: 'Hardware', price: 450000, cost: 310000, ceiling: 12, is_recurring: false },
  { id: 104, name: 'AI Edge Workstation Dual-GPU', category: 'Hardware', price: 320000, cost: 235000, ceiling: 10, is_recurring: false },
  { id: 105, name: 'Enterprise Monitor 27" 4K', category: 'Hardware', price: 55000, cost: 38000, ceiling: 15, is_recurring: false },
  { id: 106, name: 'Universal Thunderbolt 4 Dock', category: 'Accessories', price: 18000, cost: 9500, ceiling: 20, is_recurring: false },
  { id: 201, name: 'Cloud Architecture Setup Service', category: 'Services', price: 150000, cost: 85000, ceiling: 10, is_recurring: false },
  { id: 202, name: 'Premium 24x7 Support & SLA', category: 'Services', price: 75000, cost: 32000, ceiling: 10, is_recurring: true, plan_name: 'Annual 24/7 SLA' },
  { id: 203, name: 'DevOps Implementation Consulting', category: 'Services', price: 220000, cost: 120000, ceiling: 8, is_recurring: false },
  { id: 204, name: 'CyberSecurity Audit & PenTest', category: 'Services', price: 180000, cost: 95000, ceiling: 10, is_recurring: false },
  { id: 301, name: 'DealFlow360 Enterprise SaaS Seat', category: 'Subscriptions', price: 4500, cost: 900, ceiling: 15, is_recurring: true, plan_name: 'Monthly SaaS' },
  { id: 302, name: 'AI Ops Continuous Monitoring Plan', category: 'Subscriptions', price: 35000, cost: 8500, ceiling: 12, is_recurring: true, plan_name: 'Continuous AI Ops' },
  { id: 107, name: 'Industrial IoT Edge Gateway', category: 'Hardware', price: 85000, cost: 58000, ceiling: 12, is_recurring: false },
  { id: 108, name: 'High-Performance GPU Cluster Node', category: 'Hardware', price: 850000, cost: 620000, ceiling: 8, is_recurring: false },
  { id: 205, name: 'Managed Database High-Availability Setup', category: 'Services', price: 120000, cost: 65000, ceiling: 10, is_recurring: false },
];

/**
 * Recomputes quotation lines, totals, blended margin, Deal Guardian risk score,
 * and next best action in real time when any discount or quantity changes.
 */
export function recomputeWorkspace(ws: DealWorkspace): DealWorkspace {
  let grossList = 0;
  let netLinesTotal = 0;
  let totalCost = 0;
  let oneTimeNet = 0;
  let recurringNet = 0;
  let maxOverage = 0;
  let worstDiscountLineName = '';

  ws.quote.lines.forEach((line) => {
    const qty = Math.max(1, Math.round(line.qty || 1));
    const price = Number(line.price_unit) || 0;
    const discount = Math.min(100, Math.max(0, Number(line.discount_pct) || 0));
    const ceiling = Number(line.ceiling_pct) || 10;
    const cost = Number(line.unit_cost) || 0;

    line.qty = qty;
    line.discount_pct = discount;
    line.effective_discount_pct = discount;
    line.ceiling_pct = ceiling;

    const overage = Math.max(0, Math.round((discount - ceiling) * 10) / 10);
    line.overage_pts = overage;
    if (overage > maxOverage) {
      maxOverage = overage;
      worstDiscountLineName = line.product_name;
    }

    const lineGross = qty * price;
    const lineNet = Math.round(lineGross * (1 - discount / 100));
    const lineMargin = Math.round(lineNet - qty * cost);

    line.net_value = lineNet;
    line.margin = lineMargin;

    grossList += lineGross;
    netLinesTotal += lineNet;
    totalCost += qty * cost;

    if (line.is_recurring) {
      recurringNet += lineNet;
    } else {
      oneTimeNet += lineNet;
    }
  });

  const orderDiscountPct = Math.min(100, Math.max(0, Number(ws.deal.order_discount_pct) || 0));
  const orderDiscountVal = Math.round(netLinesTotal * (orderDiscountPct / 100));
  const finalNet = Math.max(0, netLinesTotal - orderDiscountVal);
  const totalDiscount = grossList - finalNet;
  const tax = Math.round(finalNet * 0.18);
  const grandTotal = finalNet + tax;
  const marginAmount = Math.max(0, finalNet - totalCost);
  const marginPct = finalNet > 0 ? Math.round((marginAmount / finalNet) * 1000) / 10 : 0;

  ws.quote.totals = {
    list: grossList,
    net: finalNet,
    tax: tax,
    total: grandTotal,
    margin_amount: marginAmount,
    margin_pct: marginPct,
    one_time: oneTimeNet,
    recurring_first_cycle: recurringNet,
  };
  ws.deal.amount_total_cache = grandTotal;

  // Dynamic Deal Guardian Risk Scoring
  let dynamicRisk = 5.0;
  // Factor 1: Discount overage penalty
  if (maxOverage > 0) {
    dynamicRisk += maxOverage * 4.2;
  }
  // Factor 2: Low margin penalty (< 22%)
  if (marginPct < 22.0) {
    dynamicRisk += (22.0 - marginPct) * 2.8;
  }
  // Factor 3: Deal scale exposure
  if (finalNet > 2000000) {
    dynamicRisk += 12.0;
  } else if (finalNet > 800000) {
    dynamicRisk += 6.0;
  }
  // Factor 4: Recurring contract risk mitigation
  if (recurringNet > 0) {
    dynamicRisk = Math.max(5.0, dynamicRisk - 4.0);
  }

  dynamicRisk = Math.min(96.0, Math.max(6.0, Math.round(dynamicRisk * 10) / 10));
  ws.risk.score = dynamicRisk;
  ws.deal.current_risk_score = dynamicRisk;

  // Severity and Required Routing
  if (dynamicRisk < 25.0) {
    ws.risk.severity = 'LOW';
    ws.deal.current_severity = 'LOW';
    ws.risk.required_level = 'REP_ONLY';
    ws.deal.required_level = 'REP_ONLY';
    if (ws.deal.health_status !== 'STALLED') ws.deal.health_status = 'HEALTHY';
  } else if (dynamicRisk < 50.0) {
    ws.risk.severity = 'MEDIUM';
    ws.deal.current_severity = 'MEDIUM';
    ws.risk.required_level = 'MANAGER_ONLY';
    ws.deal.required_level = 'MANAGER';
    if (ws.deal.health_status !== 'STALLED') ws.deal.health_status = 'WATCH';
  } else if (dynamicRisk < 75.0) {
    ws.risk.severity = 'HIGH';
    ws.deal.current_severity = 'HIGH';
    ws.risk.required_level = 'MANAGER_AND_FINANCE';
    ws.deal.required_level = 'FINANCE';
    ws.deal.health_status = 'AT_RISK';
  } else {
    ws.risk.severity = 'CRITICAL';
    ws.deal.current_severity = 'CRITICAL';
    ws.risk.required_level = 'MANAGER_AND_FINANCE';
    ws.deal.required_level = 'FINANCE';
    ws.deal.health_status = 'CRITICAL';
  }

  // Dynamic Risk Factors
  ws.risk.factors = [
    {
      factor_type: maxOverage > 0 ? 'LINE_DISCOUNT_EXCESS' : 'DISCOUNT_MARGIN',
      contribution: maxOverage > 0 ? Math.round(maxOverage * 4.2) : 5,
      reason:
        maxOverage > 0
          ? `${worstDiscountLineName} exceeds policy limit by ${maxOverage.toFixed(1)} percentage points.`
          : 'All item discounts within pre-approved sales tier governance limits.',
    },
    {
      factor_type: marginPct < 20 ? 'MARGIN_COMPRESSION' : 'CUSTOMER_PAYMENT_TERMS',
      contribution: marginPct < 20 ? Math.round((22 - marginPct) * 2.8) : 4,
      reason:
        marginPct < 20
          ? `Blended gross margin at ${marginPct.toFixed(1)}% falls below the 20.0% target floor.`
          : `Healthy blended margin at ${marginPct.toFixed(1)}% satisfies profitability rules.`,
    },
    {
      factor_type: 'DEAL_SIZE_EXPOSURE',
      contribution: finalNet > 1000000 ? 10 : 3,
      reason: `Net commercial exposure of ₹${(finalNet / 100000).toFixed(1)}L analyzed against customer credit tier.`,
    },
  ];

  // Dynamic Next Best Action
  if (ws.deal.status === 'CONFIRMED') {
    ws.deal.approval_state = 'APPROVED';
    ws.approval.state = 'APPROVED';
    ws.approval.can_decide = false;
    ws.next_best_action = {
      type: 'ORDER_CONFIRMED',
      priority: 'P1',
      title: 'Order Confirmed & Synchronized with Odoo ERP',
      description: 'Sales Order committed and released to warehouse fulfillment and accounting.',
      cta_text: 'View Fulfillment',
      cta_endpoint: '/fulfillment',
    };
  } else if (ws.deal.approval_state === 'APPROVED' || ws.approval.state === 'APPROVED') {
    ws.deal.approval_state = 'APPROVED';
    ws.approval.state = 'APPROVED';
    ws.approval.can_decide = false;
    ws.next_best_action = {
      type: 'SEND_TO_CUSTOMER',
      priority: 'P1',
      title: 'Quotation Approved — Send to Customer',
      description: 'Commercial approvals completed. Quotation unlocked and ready for customer dispatch.',
      cta_text: 'Send Quotation',
      cta_endpoint: undefined,
    };
  } else if (['PENDING_MANAGER', 'PENDING_FINANCE'].includes(ws.deal.approval_state)) {
    ws.next_best_action = {
      type: ws.deal.approval_state === 'PENDING_FINANCE' ? 'FINANCE_APPROVAL_REQUIRED' : 'MANAGER_APPROVAL_REQUIRED',
      priority: 'P1',
      title:
        ws.deal.approval_state === 'PENDING_FINANCE'
          ? 'Awaiting Commercial Finance Director Sign-Off'
          : 'Awaiting Sales Manager Commercial Approval',
      description: `Quotation evaluated at Risk ${dynamicRisk} (${ws.deal.current_severity}) with ${marginPct}% margin. Review commercial concessions.`,
      cta_text: 'Review Approval Queue',
      cta_endpoint: `/approvals/${ws.deal.id}`,
    };
  } else if (maxOverage > 0) {
    ws.next_best_action = {
      type: 'REDUCE_DISCOUNT',
      priority: 'P1',
      title: `Policy Breach: Reduce ${worstDiscountLineName} Discount`,
      description: `Line discount exceeds threshold by ${maxOverage}pt. Trim discount or submit for Manager sign-off.`,
      cta_text: 'Submit for Approval',
      cta_endpoint: undefined,
    };
  } else if (ws.deal.status === 'SENT') {
    ws.next_best_action = {
      type: 'FOLLOW_UP_CUSTOMER',
      priority: 'P2',
      title: 'Awaiting Customer Acceptance or Counteroffer',
      description: 'Quotation active in customer portal. Follow up if inactive for more than 48 hours.',
      cta_text: 'View Customer Portal',
      cta_endpoint: `/portal/quotations`,
    };
  } else {
    ws.next_best_action = {
      type: 'CONFIRM_ORDER',
      priority: 'P3',
      title: 'Proceed with Commercial Execution',
      description: 'Deal verified against commercial policy limits. Order ready for ERP sync.',
      cta_text: 'Confirm Order',
      cta_endpoint: undefined,
    };
  }

  // Sync fulfillment plan with current quote lines
  syncFulfillmentWithQuoteLines(ws);

  return ws;
}

/**
 * Syncs fulfillment warehouse allocation plan whenever quote lines change.
 * When qty is reduced or a line is removed, allocated stock is released back
 * to warehouse inventory and shipment counts are updated.
 */
export function syncFulfillmentWithQuoteLines(ws: DealWorkspace): void {
  if (!ws.fulfillment?.plan?.lines) return;

  const quoteLineIds = new Set(ws.quote.lines.map((l) => l.odoo_line_id));
  const quoteLineQtyMap = new Map(ws.quote.lines.map((l) => [l.odoo_line_id, l.qty]));

  // Remove fulfillment lines that no longer have corresponding quote lines
  ws.fulfillment.plan.lines = ws.fulfillment.plan.lines.filter((fl) =>
    quoteLineIds.has(fl.odoo_sale_order_line_id)
  );

  // For each existing fulfillment line, update requested_qty to match current quote qty
  let totalAllocated = 0;
  let warehouseCount = new Set<number>();

  ws.fulfillment.plan.lines.forEach((fl) => {
    const newQty = quoteLineQtyMap.get(fl.odoo_sale_order_line_id);
    if (newQty !== undefined) {
      const oldReqQty = fl.requested_qty;
      fl.requested_qty = newQty;

      // Proportionally scale allocated qty down if requested qty decreased
      if (newQty < oldReqQty && oldReqQty > 0) {
        const scaleFactor = newQty / oldReqQty;
        fl.allocated_qty = Math.max(0, Math.round(fl.allocated_qty * scaleFactor));
      } else if (newQty > oldReqQty) {
        // If qty increased, allocated stays as is (backorder may grow)
        fl.allocated_qty = Math.min(fl.allocated_qty, newQty);
      }

      fl.backorder_qty = Math.max(0, fl.requested_qty - fl.allocated_qty);
    }
    totalAllocated += fl.allocated_qty;
    if (fl.allocated_qty > 0) warehouseCount.add(fl.odoo_warehouse_id);
  });

  // Update plan-level aggregates
  ws.fulfillment.plan.estimated_shipments = Math.max(1, warehouseCount.size);
  ws.fulfillment.plan.estimated_shipping_cost = warehouseCount.size <= 1 ? 15.0 : 25.0;

  // Update algorithm notes to reflect the live sync
  if (ws.fulfillment.plan.lines.length > 0) {
    const notes = ws.fulfillment.plan.lines
      .map((fl) => `${fl.product_name} → ${fl.warehouse_name}: ${fl.allocated_qty} units allocated`)
      .join('; ');
    ws.fulfillment.plan.algorithm_notes = `Live sync: ${notes}. ${ws.fulfillment.plan.estimated_shipments} shipment(s) required.`;
  }
}

/**
 * Deterministically generates a realistic, diverse workspace for any deal.
 */
export function createRealisticWorkspace(
  dealId: string,
  allDeals: DealListItem[],
  allApprovals: ApprovalInboxItem[],
  goldenDealTemplate: DealWorkspace
): DealWorkspace {
  const foundDeal = allDeals.find((d) => d.id === dealId);
  const foundApproval = allApprovals.find((a) => a.id === dealId);

  // Hash ID to index (0-159)
  let numericIndex = 0;
  for (let i = 0; i < dealId.length; i++) {
    numericIndex = (numericIndex * 31 + dealId.charCodeAt(i)) % 10000;
  }
  const dealRef = foundDeal?.reference || foundApproval?.reference || `D-${2000 + (numericIndex % 160)}`;
  const refNum = parseInt(dealRef.replace(/\D/g, ''), 10) || numericIndex;

  const ws: DealWorkspace = JSON.parse(JSON.stringify(goldenDealTemplate));
  ws.deal.id = dealId;
  ws.deal.reference = dealRef;
  ws.deal.odoo_order_name = foundDeal?.odoo_order_name || `SO-2026-${(refNum % 200).toString().padStart(3, '0')}`;
  ws.deal.currency_code = 'INR';
  ws.deal.order_discount_pct = 0;

  if (foundDeal) {
    ws.deal.status = (foundDeal.status === 'PENDING_APPROVAL' ? 'DRAFT' : foundDeal.status) as any;
    ws.deal.approval_state = foundDeal.approval_state as any;
    ws.approval.state = (foundDeal.approval_state === 'DRAFT' ? 'DRAFT' : foundDeal.approval_state) as any;
    ws.deal.health_status = foundDeal.health_status;
    ws.deal.current_risk_score = foundDeal.current_risk_score;
    ws.deal.current_severity = foundDeal.current_severity;
    ws.customer.name = foundDeal.partner_name_cache;
    ws.customer.partner_id = foundDeal.partner_id;
  } else if (foundApproval) {
    ws.deal.status = 'DRAFT';
    ws.deal.approval_state =
      foundApproval.status === 'APPROVED'
        ? 'APPROVED'
        : foundApproval.status === 'PENDING'
        ? foundApproval.stage === 'Finance'
          ? 'PENDING_FINANCE'
          : 'PENDING_MANAGER'
        : (foundApproval.status as any);
    ws.approval.state = ws.deal.approval_state;
    ws.deal.current_risk_score = foundApproval.risk_score;
    ws.deal.current_severity = foundApproval.severity;
    ws.customer.name = foundApproval.customer;
  }

  // Handle APPROVED deals
  if (ws.deal.approval_state === 'APPROVED' || ws.approval.state === 'APPROVED') {
    ws.deal.approval_state = 'APPROVED';
    ws.approval.state = 'APPROVED';
    ws.approval.can_decide = false;
    ws.approval.requests = [
      {
        id: `req_${dealId}_1`,
        sequence: 1,
        required_level: 'MANAGER',
        status: 'APPROVED',
        requested_at: new Date(Date.now() - 86400000).toISOString(),
        completed_at: new Date(Date.now() - 3600000).toISOString(),
        decided_by_name: 'Sunita Rao (Regional Sales Director)',
      },
      {
        id: `req_${dealId}_2`,
        sequence: 2,
        required_level: 'MANAGER_AND_FINANCE',
        status: 'APPROVED',
        requested_at: new Date(Date.now() - 86400000).toISOString(),
        completed_at: new Date(Date.now() - 1800000).toISOString(),
        decided_by_name: 'Vikram Finance Officer',
      },
    ];
    ws.approval.actions = [
      {
        id: `act_${dealId}_1`,
        actor_name: 'Sunita Rao (Regional Sales Director)',
        actor_role: 'SALES_MANAGER',
        action: 'APPROVED',
        reason: 'Commercial terms verified and approved by Sales Director.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: `act_${dealId}_2`,
        actor_name: 'Vikram Finance Officer',
        actor_role: 'FINANCE',
        action: 'APPROVED',
        reason: 'Finance gross margin criteria satisfied. Approved and unlocked in Odoo.',
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
    ];
  } else if (ws.deal.approval_state === 'DRAFT' || ws.deal.approval_state === 'NONE' || ws.deal.approval_state === 'NOT_EVALUATED') {
    ws.approval.state = 'DRAFT';
    ws.approval.can_decide = false;
  } else if (ws.deal.approval_state === 'PENDING_MANAGER') {
    ws.approval.state = 'PENDING_MANAGER';
    ws.approval.can_decide = true;
  } else if (ws.deal.approval_state === 'PENDING_FINANCE') {
    ws.approval.state = 'PENDING_FINANCE';
    ws.approval.can_decide = true;
  }

  // Customer profile
  const tiers: Array<'GOLD' | 'SILVER' | 'BRONZE'> = ['GOLD', 'SILVER', 'BRONZE'];
  const tier = tiers[refNum % tiers.length];
  ws.customer.tier_code = tier;
  const ceiling = tier === 'GOLD' ? 15 : tier === 'SILVER' ? 12 : 8;
  ws.customer.payment_term_days = tier === 'GOLD' ? 45 : tier === 'SILVER' ? 30 : 15;
  ws.customer.past_orders_count = (refNum % 9) + 2;
  ws.customer.past_orders_spend = ((refNum % 30) + 5) * 100000;

  // Select 2-3 distinct products based on deal pattern
  const catalog = RICH_PRODUCT_CATALOG;
  const bundleSelector = refNum % 6;
  const lines: DealLine[] = [];

  if (bundleSelector === 0) {
    // Enterprise IT Fleet
    const p1 = catalog[0]; // Laptop Pro 14
    const p2 = catalog[5]; // Thunderbolt Dock
    const p3 = catalog[7]; // 24x7 Support
    const qty = ((refNum % 4) + 1) * 5;
    const isHighRisk = ws.deal.current_risk_score > 40;
    const discount1 = isHighRisk ? ceiling + 4 : ceiling - 3;

    lines.push({
      odoo_line_id: 1,
      product_id: p1.id,
      product_name: p1.name,
      category_name: p1.category,
      product_type: 'STOCKABLE',
      qty: qty,
      price_unit: p1.price,
      discount_pct: discount1,
      effective_discount_pct: discount1,
      ceiling_pct: ceiling,
      overage_pts: Math.max(0, discount1 - ceiling),
      unit_cost: p1.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 2,
      product_id: p2.id,
      product_name: p2.name,
      category_name: p2.category,
      product_type: 'STOCKABLE',
      qty: qty,
      price_unit: p2.price,
      discount_pct: ceiling,
      effective_discount_pct: ceiling,
      ceiling_pct: ceiling,
      overage_pts: 0,
      unit_cost: p2.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 3,
      product_id: p3.id,
      product_name: p3.name,
      category_name: p3.category,
      product_type: 'SERVICE',
      qty: 1,
      price_unit: p3.price,
      discount_pct: isHighRisk ? 15 : 5,
      effective_discount_pct: isHighRisk ? 15 : 5,
      ceiling_pct: 10,
      overage_pts: isHighRisk ? 5 : 0,
      unit_cost: p3.cost,
      net_value: 0,
      margin: 0,
      is_recurring: true,
      plan_name: p3.plan_name,
    });
  } else if (bundleSelector === 1) {
    // Cloud Infrastructure Migration
    const p1 = catalog[2]; // Cloud Rack Server X1
    const p2 = catalog[6]; // Cloud Architecture Setup Service
    const p3 = catalog[14]; // Managed DB HA
    const qty = (refNum % 3) + 2;
    const isHighRisk = ws.deal.current_risk_score > 40;
    const discount1 = isHighRisk ? ceiling + 6 : ceiling - 2;

    lines.push({
      odoo_line_id: 1,
      product_id: p1.id,
      product_name: p1.name,
      category_name: p1.category,
      product_type: 'STOCKABLE',
      qty: qty,
      price_unit: p1.price,
      discount_pct: discount1,
      effective_discount_pct: discount1,
      ceiling_pct: ceiling,
      overage_pts: Math.max(0, discount1 - ceiling),
      unit_cost: p1.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 2,
      product_id: p2.id,
      product_name: p2.name,
      category_name: p2.category,
      product_type: 'SERVICE',
      qty: 1,
      price_unit: p2.price,
      discount_pct: isHighRisk ? 18 : 5,
      effective_discount_pct: isHighRisk ? 18 : 5,
      ceiling_pct: 10,
      overage_pts: isHighRisk ? 8 : 0,
      unit_cost: p2.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 3,
      product_id: p3.id,
      product_name: p3.name,
      category_name: p3.category,
      product_type: 'SERVICE',
      qty: 1,
      price_unit: p3.price,
      discount_pct: 0,
      effective_discount_pct: 0,
      ceiling_pct: 10,
      overage_pts: 0,
      unit_cost: p3.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
  } else if (bundleSelector === 2) {
    // AI & High Performance Computing
    const p1 = catalog[3]; // AI Edge Workstation
    const p2 = catalog[4]; // 4K Monitor 32"
    const p3 = catalog[11]; // AI Ops Continuous Monitoring
    const qty = (refNum % 4) + 2;
    const isHighRisk = ws.deal.current_risk_score > 45;
    const discount1 = isHighRisk ? ceiling + 5 : ceiling - 4;

    lines.push({
      odoo_line_id: 1,
      product_id: p1.id,
      product_name: p1.name,
      category_name: p1.category,
      product_type: 'STOCKABLE',
      qty: qty,
      price_unit: p1.price,
      discount_pct: discount1,
      effective_discount_pct: discount1,
      ceiling_pct: ceiling,
      overage_pts: Math.max(0, discount1 - ceiling),
      unit_cost: p1.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 2,
      product_id: p2.id,
      product_name: p2.name,
      category_name: p2.category,
      product_type: 'STOCKABLE',
      qty: qty * 2,
      price_unit: p2.price,
      discount_pct: ceiling,
      effective_discount_pct: ceiling,
      ceiling_pct: ceiling,
      overage_pts: 0,
      unit_cost: p2.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 3,
      product_id: p3.id,
      product_name: p3.name,
      category_name: p3.category,
      product_type: 'SERVICE',
      qty: 1,
      price_unit: p3.price,
      discount_pct: isHighRisk ? 14 : 0,
      effective_discount_pct: isHighRisk ? 14 : 0,
      ceiling_pct: 12,
      overage_pts: isHighRisk ? 2 : 0,
      unit_cost: p3.cost,
      net_value: 0,
      margin: 0,
      is_recurring: true,
      plan_name: p3.plan_name,
    });
  } else if (bundleSelector === 3) {
    // DevOps & Cyber Security
    const p1 = catalog[9]; // CyberSecurity Audit
    const p2 = catalog[8]; // DevOps Consulting
    const p3 = catalog[10]; // SaaS Seats
    const seats = ((refNum % 5) + 1) * 25;
    const isHighRisk = ws.deal.current_risk_score > 40;

    lines.push({
      odoo_line_id: 1,
      product_id: p1.id,
      product_name: p1.name,
      category_name: p1.category,
      product_type: 'SERVICE',
      qty: 1,
      price_unit: p1.price,
      discount_pct: isHighRisk ? 18 : 5,
      effective_discount_pct: isHighRisk ? 18 : 5,
      ceiling_pct: 10,
      overage_pts: isHighRisk ? 8 : 0,
      unit_cost: p1.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 2,
      product_id: p2.id,
      product_name: p2.name,
      category_name: p2.category,
      product_type: 'SERVICE',
      qty: 1,
      price_unit: p2.price,
      discount_pct: isHighRisk ? 14 : 4,
      effective_discount_pct: isHighRisk ? 14 : 4,
      ceiling_pct: 8,
      overage_pts: isHighRisk ? 6 : 0,
      unit_cost: p2.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 3,
      product_id: p3.id,
      product_name: p3.name,
      category_name: p3.category,
      product_type: 'SERVICE',
      qty: seats,
      price_unit: p3.price,
      discount_pct: 10,
      effective_discount_pct: 10,
      ceiling_pct: 15,
      overage_pts: 0,
      unit_cost: p3.cost,
      net_value: 0,
      margin: 0,
      is_recurring: true,
      plan_name: p3.plan_name,
    });
  } else if (bundleSelector === 4) {
    // Executive Mobility & UltraBook Fleet
    const p1 = catalog[1]; // UltraBook 13
    const p2 = catalog[5]; // Thunderbolt Dock
    const p3 = catalog[7]; // Premium Support
    const qty = ((refNum % 4) + 2) * 4;
    const isHighRisk = ws.deal.current_risk_score > 40;

    lines.push({
      odoo_line_id: 1,
      product_id: p1.id,
      product_name: p1.name,
      category_name: p1.category,
      product_type: 'STOCKABLE',
      qty: qty,
      price_unit: p1.price,
      discount_pct: isHighRisk ? ceiling + 5 : ceiling - 2,
      effective_discount_pct: isHighRisk ? ceiling + 5 : ceiling - 2,
      ceiling_pct: ceiling,
      overage_pts: isHighRisk ? 5 : 0,
      unit_cost: p1.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 2,
      product_id: p2.id,
      product_name: p2.name,
      category_name: p2.category,
      product_type: 'STOCKABLE',
      qty: qty,
      price_unit: p2.price,
      discount_pct: ceiling,
      effective_discount_pct: ceiling,
      ceiling_pct: ceiling,
      overage_pts: 0,
      unit_cost: p2.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 3,
      product_id: p3.id,
      product_name: p3.name,
      category_name: p3.category,
      product_type: 'SERVICE',
      qty: 1,
      price_unit: p3.price,
      discount_pct: 5,
      effective_discount_pct: 5,
      ceiling_pct: 10,
      overage_pts: 0,
      unit_cost: p3.cost,
      net_value: 0,
      margin: 0,
      is_recurring: true,
      plan_name: p3.plan_name,
    });
  } else {
    // Smart IoT & Industrial Automation
    const p1 = catalog[12]; // IoT Edge Gateway
    const p2 = catalog[0]; // Laptop Pro 14
    const p3 = catalog[6]; // Cloud Architecture Setup
    const qty = ((refNum % 5) + 3) * 5;
    const isHighRisk = ws.deal.current_risk_score > 40;

    lines.push({
      odoo_line_id: 1,
      product_id: p1.id,
      product_name: p1.name,
      category_name: p1.category,
      product_type: 'STOCKABLE',
      qty: qty,
      price_unit: p1.price,
      discount_pct: isHighRisk ? ceiling + 4 : ceiling - 3,
      effective_discount_pct: isHighRisk ? ceiling + 4 : ceiling - 3,
      ceiling_pct: ceiling,
      overage_pts: isHighRisk ? 4 : 0,
      unit_cost: p1.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 2,
      product_id: p2.id,
      product_name: p2.name,
      category_name: p2.category,
      product_type: 'STOCKABLE',
      qty: 2,
      price_unit: p2.price,
      discount_pct: ceiling,
      effective_discount_pct: ceiling,
      ceiling_pct: ceiling,
      overage_pts: 0,
      unit_cost: p2.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
    lines.push({
      odoo_line_id: 3,
      product_id: p3.id,
      product_name: p3.name,
      category_name: p3.category,
      product_type: 'SERVICE',
      qty: 1,
      price_unit: p3.price,
      discount_pct: isHighRisk ? 15 : 0,
      effective_discount_pct: isHighRisk ? 15 : 0,
      ceiling_pct: 10,
      overage_pts: isHighRisk ? 5 : 0,
      unit_cost: p3.cost,
      net_value: 0,
      margin: 0,
      is_recurring: false,
    });
  }

  ws.quote.lines = lines;

  // Recommendations
  const nextProd = catalog[(refNum + 7) % catalog.length];
  ws.recommendations = [
    {
      id: `rec_${refNum}_1`,
      product_id: nextProd.id,
      product_name: nextProd.name,
      category: nextProd.category,
      list_price: nextProd.price,
      unit_cost: nextProd.cost,
      recommended_discount_pct: 5,
      score: 88,
      margin_impact: nextProd.price - nextProd.cost,
      margin_delta_pts: 1.8,
      reason: `Frequently bundled with ${ws.customer.name} orders. Accretive to gross deal margin.`,
      status: 'ACTIVE',
    },
  ];

  // Approval state capabilities
  ws.approval.can_decide =
    ws.deal.approval_state === 'PENDING_MANAGER' || ws.deal.approval_state === 'PENDING_FINANCE';

  // Perform complete live recalculation
  return recomputeWorkspace(ws);
}

import { DealContext, GuardianEvaluationResult, LineItem, RiskFactor, RiskSeverity } from '../types';
import { evaluatePolicyCeilings } from './policyEngine';
import { calculateFulfillmentPlan } from './fulfillmentEngine';
import { synthesizeNextBestAction } from './nbaEngine';

export function calculateCommercialTotals(lines: LineItem[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let netTotal = 0;
  let totalCost = 0;

  for (const line of lines) {
    const lineGross = line.unitPrice * line.quantity;
    const discountAmount = lineGross * (line.discountPercent / 100);
    const lineNet = lineGross - discountAmount;
    const lineCost = line.costPrice * line.quantity;

    subtotal += lineGross;
    discountTotal += discountAmount;
    netTotal += lineNet;
    totalCost += lineCost;
  }

  const grossMarginAmount = netTotal - totalCost;
  const marginPercent = netTotal > 0 ? (grossMarginAmount / netTotal) * 100 : 0;

  return {
    subtotal,
    discountTotal,
    netTotal,
    totalCost,
    grossMarginAmount,
    marginPercent,
  };
}

export function evaluateDealGuardian(deal: DealContext): GuardianEvaluationResult {
  const totals = calculateCommercialTotals(deal.lines);
  const policyChecks = evaluatePolicyCeilings(deal.customerTier, deal.lines);
  const fulfillment = calculateFulfillmentPlan(deal.id, deal.lines);

  const factors: RiskFactor[] = [];

  // 1. Discount Excess Factor
  const breachedPolicies = policyChecks.filter((p) => p.isBreached);
  const maxExcess = breachedPolicies.length > 0 
    ? Math.max(...breachedPolicies.map((p) => p.excessPercent)) 
    : 0;

  let discountExposureScore = 0;
  if (maxExcess > 0) {
    // If excess is 8% (e.g. 18% - 10%), score is 22. If excess is 12% (e.g. 22% - 10%), score is 29.
    discountExposureScore = Math.round(14 + maxExcess);
    const worstBreach = breachedPolicies.sort((a, b) => b.excessPercent - a.excessPercent)[0];
    factors.push({
      id: 'rf-discount',
      category: 'DISCOUNT_EXCESS',
      name: 'Discount policy ceiling exceeded',
      scoreImpact: discountExposureScore,
      explanation: `${worstBreach.productName} discount of ${worstBreach.appliedDiscount.toFixed(1)}% exceeds the ${worstBreach.category} ceiling of ${worstBreach.effectiveCeiling.toFixed(1)}% by ${worstBreach.excessPercent.toFixed(1)}%.`,
      violatingLineId: worstBreach.lineId,
    });
  } else {
    // Healthy baseline discount contribution
    const avgDiscount = totals.subtotal > 0 ? (totals.discountTotal / totals.subtotal) * 100 : 0;
    discountExposureScore = Math.min(10, Math.round(avgDiscount * 0.5));
    if (discountExposureScore > 0) {
      factors.push({
        id: 'rf-discount-ok',
        category: 'DISCOUNT_EXCESS',
        name: 'Standard discount within policy limits',
        scoreImpact: discountExposureScore,
        explanation: `All line discounts are strictly within allowed ${deal.customerTier} tier guidelines.`,
      });
    }
  }

  // 2. Margin Exposure Factor
  let marginExposureScore = 0;
  if (totals.marginPercent < 18) {
    marginExposureScore = 20;
    factors.push({
      id: 'rf-margin',
      category: 'MARGIN_EROSION',
      name: 'Severe gross margin dilution',
      scoreImpact: marginExposureScore,
      explanation: `Gross margin of ${totals.marginPercent.toFixed(1)}% is below the corporate minimum requirement (20.0%).`,
    });
  } else if (totals.marginPercent < 25) {
    marginExposureScore = 14;
    factors.push({
      id: 'rf-margin',
      category: 'MARGIN_EROSION',
      name: 'Gross margin below preferred threshold',
      scoreImpact: marginExposureScore,
      explanation: `Gross margin of ${totals.marginPercent.toFixed(1)}% is compressed beneath the preferred 25.0% target.`,
    });
  } else {
    marginExposureScore = 4;
    factors.push({
      id: 'rf-margin-ok',
      category: 'MARGIN_EROSION',
      name: 'Healthy gross margin profile',
      scoreImpact: marginExposureScore,
      explanation: `Gross margin of ${totals.marginPercent.toFixed(1)}% satisfies enterprise profit thresholds.`,
    });
  }

  // 3. Stock Fragmentation / Fulfillment Risk Factor
  let stockFragmentationScore = 0;
  if (fulfillment.status === 'SPLIT_REQUIRED') {
    stockFragmentationScore = 8;
    factors.push({
      id: 'rf-stock-split',
      category: 'STOCK_FRAGMENTATION',
      name: 'Multi-facility split shipment required',
      scoreImpact: stockFragmentationScore,
      explanation: 'Stock allocation requires shipping from both Main Warehouse and East Depot (2 split consignments).',
    });
  } else if (fulfillment.status === 'BACKORDER_REQUIRED') {
    stockFragmentationScore = 16;
    factors.push({
      id: 'rf-stock-backorder',
      category: 'STOCK_FRAGMENTATION',
      name: 'Inventory deficit requires backorder',
      scoreImpact: stockFragmentationScore,
      explanation: 'Warehouse stock is insufficient across all regional facilities; backorder procurement required.',
    });
  } else {
    stockFragmentationScore = 2;
  }

  // 4. Deal Staleness / Approval Governance Factor
  let delayScore = 0;
  const daysInactive = getDaysInactive(deal.lastActivityDate);
  if (daysInactive >= 5) {
    delayScore = 17;
    factors.push({
      id: 'rf-delay',
      category: 'DEAL_DELAY',
      name: 'Deal stalled without recent customer engagement',
      scoreImpact: delayScore,
      explanation: `No quote progression or customer activity recorded in the past ${daysInactive} days.`,
    });
  } else if (breachedPolicies.length > 0) {
    delayScore = 17;
    factors.push({
      id: 'rf-approval-overhead',
      category: 'DEAL_DELAY',
      name: 'Executive approval routing latency risk',
      scoreImpact: delayScore,
      explanation: 'Multi-tier financial sign-off requirement adds commercial review overhead.',
    });
  } else {
    delayScore = 2;
  }

  // Blended Risk Score calculation
  let blendedScore = discountExposureScore + marginExposureScore + stockFragmentationScore + delayScore;
  blendedScore = Math.max(0, Math.min(100, blendedScore));

  // Severity Level mapping
  let severity: RiskSeverity = 'LOW';
  let dealHealth: 'HEALTHY' | 'WATCH' | 'AT_RISK' = 'HEALTHY';
  let requiredApprovalRole: 'NONE' | 'SALES_MANAGER' | 'FINANCE_DIRECTOR' = 'NONE';

  if (blendedScore >= 80) {
    severity = 'CRITICAL';
    dealHealth = 'AT_RISK';
    requiredApprovalRole = 'FINANCE_DIRECTOR';
  } else if (blendedScore >= 60) {
    severity = 'HIGH';
    dealHealth = 'AT_RISK';
    requiredApprovalRole = 'FINANCE_DIRECTOR';
  } else if (blendedScore >= 30) {
    severity = 'MEDIUM';
    dealHealth = 'WATCH';
    requiredApprovalRole = 'SALES_MANAGER';
  } else {
    severity = 'LOW';
    dealHealth = 'HEALTHY';
    requiredApprovalRole = 'NONE';
  }

  const nba = synthesizeNextBestAction(deal, blendedScore, severity, requiredApprovalRole, breachedPolicies);

  return {
    dealId: deal.id,
    dealVersion: deal.version,
    blendedRiskScore: blendedScore,
    severity,
    dealHealth,
    factors,
    requiredApprovalRole,
    policyCeilingBreached: breachedPolicies.length > 0,
    tierCeilingBreached: policyChecks.some(p => p.isTierBreached),
    tierViolationMessage: policyChecks.find(p => p.isTierBreached)?.explanation,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    netTotal: totals.netTotal,
    totalCost: totals.totalCost,
    grossMarginAmount: totals.grossMarginAmount,
    marginPercent: totals.marginPercent,
    nextBestAction: nba,
    evaluatedAt: new Date().toISOString(),
  };
}

function getDaysInactive(dateString: string): number {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

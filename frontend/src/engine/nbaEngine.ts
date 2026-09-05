import { DealContext, NextBestAction, RiskSeverity } from '../types';
import { PolicyCheckResult } from './policyEngine';

export function synthesizeNextBestAction(
  deal: DealContext,
  blendedRiskScore: number,
  severity: RiskSeverity,
  requiredRole: 'NONE' | 'SALES_MANAGER' | 'FINANCE_DIRECTOR',
  breaches: PolicyCheckResult[]
): NextBestAction {
  // 1. Priority: Invalidated Deal requiring Executive Re-Approval
  if (deal.state === 'INVALIDATED') {
    return {
      actionType: 'RE_APPROVAL_REQUIRED',
      title: 'Executive Re-Approval Required',
      description: 'Customer counteroffer exceeded approved commercial terms. Baseline invalidated.',
      priority: 'CRITICAL',
      buttonLabel: 'Submit for Re-Approval',
      targetAction: 'REQUEST_REAPPROVAL',
    };
  }

  // 2. Customer Counteroffer pending review
  if (deal.negotiationActive) {
    return {
      actionType: 'REVIEW_CUSTOMER_COUNTEROFFER',
      title: 'Review Customer Counteroffer',
      description: 'Customer requested discount concession on Cloud Architecture Setup.',
      priority: 'CRITICAL',
      buttonLabel: 'Review Counteroffer',
      targetAction: 'VIEW_NEGOTIATION',
    };
  }

  // 3. Finance Approval Required
  if (deal.state === 'PENDING_FINANCE' || (requiredRole === 'FINANCE_DIRECTOR' && deal.state !== 'APPROVED' && deal.state !== 'CONFIRMED')) {
    const worstBreach = breaches[0];
    const breachNote = worstBreach 
      ? `${worstBreach.productName} (${worstBreach.appliedDiscount.toFixed(1)}% vs ${worstBreach.effectiveCeiling.toFixed(1)}% limit)`
      : 'Blended risk score exceeds policy threshold';

    return {
      actionType: 'FINANCE_APPROVAL_REQUIRED',
      title: 'Finance Approval Required',
      description: `Risk score ${blendedRiskScore}/100 (${severity}). Concession on ${breachNote} requires executive sign-off.`,
      priority: 'HIGH',
      buttonLabel: 'Route to Finance',
      targetAction: 'SUBMIT_APPROVAL',
    };
  }

  // 4. Sales Manager Approval Required
  if (deal.state === 'PENDING_MANAGER' || (requiredRole === 'SALES_MANAGER' && deal.state !== 'APPROVED' && deal.state !== 'CONFIRMED')) {
    return {
      actionType: 'MANAGER_APPROVAL_REQUIRED',
      title: 'Sales Manager Approval Required',
      description: `Blended risk score ${blendedRiskScore}/100 requires supervisory validation before sending to customer.`,
      priority: 'HIGH',
      buttonLabel: 'Submit for Approval',
      targetAction: 'SUBMIT_APPROVAL',
    };
  }

  // 5. Approved Deal Ready for Odoo ERP Booking
  if (deal.state === 'APPROVED') {
    return {
      actionType: 'CONFIRM_QUOTATION_IN_ODOO',
      title: 'Confirm Quotation in Odoo',
      description: 'Commercial governance sign-offs are satisfied. Ready to commit sale order in Odoo ERP.',
      priority: 'NORMAL',
      buttonLabel: 'Confirm Order in Odoo',
      targetAction: 'CONFIRM_ODOO_ORDER',
    };
  }

  // 6. Confirmed Deal in Fulfillment
  if (deal.state === 'CONFIRMED') {
    return {
      actionType: 'MONITOR_FULFILLMENT',
      title: 'Order Booked in Odoo',
      description: 'Sale order active. Stock delivery pickings dispatched to regional warehouses.',
      priority: 'NORMAL',
      buttonLabel: 'View Fulfillment Hub',
      targetAction: 'VIEW_FULFILLMENT',
    };
  }

  // 7. Draft Deal within Safe Policy
  return {
    actionType: 'SEND_QUOTE_TO_CUSTOMER',
    title: 'Send Quotation to Customer',
    description: 'All proposed items and pricing are within approved policy limits. Safe to issue to buyer.',
    priority: 'NORMAL',
    buttonLabel: 'Generate Customer Link',
    targetAction: 'SEND_CUSTOMER',
  };
}

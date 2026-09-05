/**
 * DealFlow360 — Integrated API Client
 * 
 * Provides unified, resilient HTTP connectivity from the Frontend to:
 * 1. FastAPI Decision Engine Gateway (/api/governance/*)
 * 2. Odoo Transactional REST API (/api/dealflow/* and /dealflow/portal/*)
 * 
 * Includes defensive fallback handling to preserve UI fluidity during development/demos.
 */

import { DealContext } from '../types';

export interface BackendHealthStatus {
  gateway: boolean;
  odoo: boolean;
  gatewayVersion?: string;
  odooVersion?: string;
}

const GATEWAY_BASE_URL = (typeof window !== 'undefined' && (window as any).__GATEWAY_URL__) || '';
const ODOO_BASE_URL = (typeof window !== 'undefined' && (window as any).__ODOO_URL__) || '';

export class DealFlowApiClient {
  /**
   * Probes health of both the FastAPI Decision Engine Gateway and Odoo ERP endpoints.
   */
  static async checkHealth(): Promise<BackendHealthStatus> {
    const status: BackendHealthStatus = { gateway: false, odoo: false };

    try {
      const resp = await fetch(`${GATEWAY_BASE_URL}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (resp.ok) {
        const data = await resp.json();
        status.gateway = true;
        status.gatewayVersion = data.version;
      }
    } catch {
      // Gateway unreachable
    }

    try {
      const resp = await fetch(`${ODOO_BASE_URL}/api/dealflow/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (resp.ok) {
        const data = await resp.json();
        status.odoo = true;
        status.odooVersion = data.version;
      }
    } catch {
      // Odoo unreachable
    }

    return status;
  }

  /**
   * Executes live Deal Guardian evaluation on a DealContext via FastAPI Gateway.
   */
  static async evaluateDeal(deal: DealContext, approvedBaseline?: DealContext | null): Promise<any> {
    const payload = {
      deal_id: deal.id,
      odoo_sale_order_id: parseInt(deal.odooOrderId.replace(/\D/g, '')) || 1,
      order_name: deal.odooOrderId || 'SO0001',
      customer: {
        odoo_partner_id: parseInt(deal.customerId.replace(/\D/g, '')) || 1,
        name: deal.customerName,
        tier: deal.customerTier,
      },
      lines: deal.lines.map((l, idx) => ({
        odoo_line_id: parseInt(l.id.replace(/\D/g, '')) || idx + 1,
        odoo_product_id: parseInt(l.productId.replace(/\D/g, '')) || 72,
        product_name: l.name,
        category_name: l.category,
        odoo_category_id: 1,
        quantity: l.quantity,
        price_unit: l.unitPrice,
        cost_unit: l.costPrice,
        discount_pct: l.discountPercent,
        is_recurring: Boolean(l.isSubscription),
      })),
      currency: deal.currency || 'INR',
    };

    const resp = await fetch(`${GATEWAY_BASE_URL}/api/governance/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: payload,
        approved_baseline: approvedBaseline ? payload : null,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Gateway evaluation failed with HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  /**
   * Retrieves order context from Odoo REST API.
   */
  static async getOdooOrderContext(orderId: number, authToken?: string): Promise<any> {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const resp = await fetch(`${ODOO_BASE_URL}/api/dealflow/order/${orderId}/context`, {
      method: 'GET',
      headers,
    });

    if (!resp.ok) {
      throw new Error(`Failed to fetch Odoo context for order ${orderId}: HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  /**
   * Triggers Deal Guardian evaluation directly inside Odoo module.
   */
  static async evaluateOdooOrder(orderId: number, authToken?: string): Promise<any> {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const resp = await fetch(`${ODOO_BASE_URL}/api/dealflow/order/${orderId}/evaluate`, {
      method: 'POST',
      headers,
    });

    if (!resp.ok) {
      throw new Error(`Odoo order evaluation failed: HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  /**
   * Submits a customer negotiation proposal to the portal negotiation endpoint.
   */
  static async submitCustomerNegotiation(orderId: number, requestedDiscount: number, customerNote?: string): Promise<any> {
    const resp = await fetch(`${ODOO_BASE_URL}/dealflow/portal/negotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        requested_discount: requestedDiscount,
        customer_note: customerNote || 'Requested customer counter-offer.',
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Negotiation submission failed with HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  /**
   * Confirms a locked sale order using cryptographic approval token.
   */
  static async confirmOrder(orderId: number, approvalToken?: string, authToken?: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const resp = await fetch(`${ODOO_BASE_URL}/api/dealflow/order/${orderId}/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ approval_token: approvalToken }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Confirmation failed with HTTP ${resp.status}`);
    }
    return await resp.json();
  }
}

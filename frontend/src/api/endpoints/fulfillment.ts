import { apiClient } from '../client';
import type { DealFulfillment } from '../types';

export const fulfillmentApi = {
  get: (dealId: string): Promise<DealFulfillment> =>
    apiClient(`/deals/${dealId}/fulfillment`),

  propose: (dealId: string): Promise<DealFulfillment> =>
    apiClient(`/deals/${dealId}/fulfillment/propose`, { method: 'POST' }),

  accept: (dealId: string): Promise<DealFulfillment> =>
    apiClient(`/deals/${dealId}/fulfillment/accept`, { method: 'POST' }),

  override: (
    dealId: string,
    payload: {
      allocations: Array<{ odoo_sale_order_line_id: number; odoo_warehouse_id: number; qty: number }>;
      reason: string;
    }
  ): Promise<DealFulfillment> =>
    apiClient(`/deals/${dealId}/fulfillment/override`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  apply: (dealId: string): Promise<DealFulfillment> =>
    apiClient(`/deals/${dealId}/fulfillment/apply`, { method: 'POST' }),

  consolidate: (dealId: string, payload: { warehouse_id: number; qty?: number }): Promise<DealFulfillment> =>
    apiClient(`/deals/${dealId}/fulfillment/consolidate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getExceptions: (): Promise<any[]> => apiClient('/fulfillment/exceptions'),
};

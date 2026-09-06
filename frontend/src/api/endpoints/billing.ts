import { apiClient } from '../client';
import type { DealBilling } from '../types';

export const billingApi = {
  get: (dealId: string): Promise<DealBilling> =>
    apiClient(`/deals/${dealId}/billing`),

  recordPayment: (
    dealId: string,
    invoiceId: number,
    payload: { amount: number; journal_id?: number }
  ): Promise<any> =>
    apiClient(`/deals/${dealId}/billing/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listInvoices: (params: Record<string, any> = {}): Promise<any[]> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/odoo/invoices?${qs.toString()}`);
  },

  getInvoice: (id: number | string): Promise<any> =>
    apiClient(`/odoo/invoices/${id}`),

  listSubscriptions: (params: Record<string, any> = {}): Promise<any[]> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/odoo/subscriptions?${qs.toString()}`);
  },

  cancelSubscription: (
    dealId: string,
    subscriptionId: number | string = 101,
    payload: { reason?: string } = {}
  ): Promise<any> =>
    apiClient(`/deals/${dealId}/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};


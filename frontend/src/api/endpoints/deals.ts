import { apiClient } from '../client';
import type { DealWorkspace } from '../types';

export const dealsApi = {
  list: (params: Record<string, any> = {}): Promise<{ items: any[]; total: number; page: number; page_size: number }> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/deals?${qs.toString()}`);
  },

  pipeline: (): Promise<{ columns: Array<{ status: string; items: any[] }> }> =>
    apiClient('/deals?pipeline=true'),

  create: (partner_id: number, lines: Array<{ product_id: number; qty: number; discount_pct?: number }>, currency?: string): Promise<any> =>
    apiClient('/deals', {
      method: 'POST',
      body: JSON.stringify({ partner_id, lines, currency: currency || 'INR' }),
    }),

  createFromOdoo: (odoo_sale_order_id: number): Promise<any> =>
    apiClient('/deals/from-odoo', {
      method: 'POST',
      body: JSON.stringify({ odoo_sale_order_id }),
    }),

  getWorkspace: (id: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${id}/workspace`),

  evaluate: (id: string): Promise<any> =>
    apiClient(`/deals/${id}/evaluate`, { method: 'POST' }),

  patch: (id: string, patchData: Record<string, any>): Promise<DealWorkspace> =>
    apiClient(`/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patchData),
    }),

  addLine: (dealId: string, line: { product_id: number; qty: number; discount_pct?: number }): Promise<DealWorkspace> =>
    apiClient(`/deals/${dealId}/lines`, {
      method: 'POST',
      body: JSON.stringify(line),
    }),

  patchLine: (dealId: string, lineId: number, patchData: { qty?: number; discount_pct?: number }): Promise<DealWorkspace> =>
    apiClient(`/deals/${dealId}/lines/${lineId}`, {
      method: 'PATCH',
      body: JSON.stringify(patchData),
    }),

  deleteLine: (dealId: string, lineId: number): Promise<DealWorkspace> =>
    apiClient(`/deals/${dealId}/lines/${lineId}`, { method: 'DELETE' }),

  submit: (id: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${id}/submit`, { method: 'POST' }),

  send: (id: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${id}/send`, { method: 'POST' }),

  acceptProposalAndAddItem: (dealId: string, payload: { request_id: string; product_id?: number; qty?: number; discount_pct?: number }): Promise<DealWorkspace> =>
    apiClient(`/deals/${dealId}/accept-proposal-and-add-item`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirm: (id: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${id}/confirm`, { method: 'POST' }),

  cancel: (id: string, reason: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getTimeline: (id: string): Promise<any[]> =>
    apiClient(`/deals/${id}/timeline`),

  getAssessment: (dealId: string, aid: string): Promise<any> =>
    apiClient(`/deals/${dealId}/assessments/${aid}`),
};

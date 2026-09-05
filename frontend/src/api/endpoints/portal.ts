import { apiClient } from '../client';

export const portalApi = {
  getDeals: (): Promise<any[]> => apiClient('/portal/deals'),

  getDeal: (id: string): Promise<any> => apiClient(`/portal/deals/${id}`),

  getBilling: (id: string): Promise<any> => apiClient(`/portal/deals/${id}/billing`),

  getRevisions: (id: string): Promise<any[]> => apiClient(`/portal/deals/${id}/revisions`),

  submitNegotiation: (
    dealId: string,
    payload: { type: string; line_id?: number | null; requested_value?: number; message?: string }
  ): Promise<any> =>
    apiClient(`/portal/deals/${dealId}/negotiations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  withdrawNegotiation: (dealId: string, requestId: string): Promise<any> =>
    apiClient(`/portal/deals/${dealId}/negotiations/${requestId}/withdraw`, {
      method: 'POST',
    }),

  addComment: (dealId: string, payload: { body: string; line_id?: number | null }): Promise<any> =>
    apiClient(`/portal/deals/${dealId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirmDeal: (dealId: string, payload: { accept_terms: boolean; confirm_with_open_requests?: boolean }): Promise<any> =>
    apiClient(`/portal/deals/${dealId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMessages: (): Promise<any[]> => apiClient('/portal/notifications'),
};

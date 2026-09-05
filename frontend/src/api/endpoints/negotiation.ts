import { apiClient } from '../client';

export const negotiationApi = {
  getRequests: (dealId: string): Promise<any[]> =>
    apiClient(`/deals/${dealId}/negotiations`),

  respond: (
    dealId: string,
    requestId: string,
    payload: { decision: 'ACCEPT' | 'REJECT' | 'COUNTER'; message?: string; counter_value?: number }
  ): Promise<any> =>
    apiClient(`/deals/${dealId}/negotiations/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getComments: (dealId: string): Promise<any[]> =>
    apiClient(`/deals/${dealId}/comments`),

  addComment: (
    dealId: string,
    payload: { body: string; line_id?: number | null; is_internal?: boolean }
  ): Promise<any> =>
    apiClient(`/deals/${dealId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

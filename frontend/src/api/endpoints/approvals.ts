import { apiClient } from '../client';
import type { DealWorkspace } from '../types';

export const approvalsApi = {
  getInbox: (): Promise<any[]> => apiClient('/approvals/inbox'),

  list: (params: Record<string, any> = {}): Promise<any[]> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/approvals?${qs.toString()}`);
  },

  approve: (dealId: string, reason?: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${dealId}/approval/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    }),

  reject: (dealId: string, reason: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${dealId}/approval/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  returnForRevision: (dealId: string, reason: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${dealId}/approval/return`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  escalate: (dealId: string, reason?: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${dealId}/approval/escalate`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    }),
};

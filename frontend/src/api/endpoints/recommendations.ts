import { apiClient } from '../client';
import type { DealWorkspace } from '../types';

export const recommendationsApi = {
  get: (dealId: string): Promise<any[]> =>
    apiClient(`/deals/${dealId}/recommendations`),

  add: (dealId: string, recommendationId: string): Promise<DealWorkspace> =>
    apiClient(`/deals/${dealId}/recommendations/${recommendationId}/add`, {
      method: 'POST',
    }),

  dismiss: (dealId: string, recommendationId: string): Promise<void> =>
    apiClient(`/deals/${dealId}/recommendations/${recommendationId}/dismiss`, {
      method: 'POST',
    }),
};

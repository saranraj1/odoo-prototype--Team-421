import { apiClient } from '../client';
import type { ControlTowerData, DealAlertItem } from '../types';

export const healthApi = {
  getControlTower: (): Promise<ControlTowerData> =>
    apiClient('/dashboard/control-tower'),

  getAlerts: (params: Record<string, any> = {}): Promise<DealAlertItem[]> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/alerts?${qs.toString()}`);
  },

  acknowledgeAlert: (id: string): Promise<void> =>
    apiClient(`/alerts/${id}/acknowledge`, { method: 'POST' }),

  resolveAlert: (id: string): Promise<void> =>
    apiClient(`/alerts/${id}/resolve`, { method: 'POST' }),

  actOnAlert: (id: string, payload: { action: 'NUDGE' | 'ESCALATE'; message?: string }): Promise<void> =>
    apiClient(`/alerts/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  recomputeAlerts: (): Promise<{ message: string }> =>
    apiClient('/alerts/recompute', { method: 'POST' }),
};

import { apiClient } from '../client';

export const configApi = {
  getTiers: (): Promise<any[]> => apiClient('/tiers'),
  saveTier: (tier: any): Promise<any> => apiClient('/tiers', { method: 'POST', body: JSON.stringify(tier) }),

  getPolicies: (): Promise<any[]> => apiClient('/policies'),
  savePolicy: (policy: any): Promise<any> => apiClient('/policies', { method: 'POST', body: JSON.stringify(policy) }),

  simulatePolicy: (dealId: string): Promise<any> =>
    apiClient('/policies/simulate', { method: 'POST', body: JSON.stringify({ deal_id: dealId }) }),

  getWarehouseProfiles: (): Promise<any[]> => apiClient('/warehouse-profiles'),
  saveWarehouseProfile: (profile: any): Promise<any> =>
    apiClient('/warehouse-profiles', { method: 'POST', body: JSON.stringify(profile) }),

  getRecommendationRules: (): Promise<any[]> => apiClient('/recommendation-rules'),
  mineRecommendations: (): Promise<{ mined_count: number }> =>
    apiClient('/recommendation-rules/mine', { method: 'POST' }),

  getSettings: (): Promise<Record<string, any>> => apiClient('/admin/settings'),
  updateSettings: (settings: Record<string, any>): Promise<any> =>
    apiClient('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  getUsers: (): Promise<any[]> => apiClient('/admin/users'),
  getOdooHealth: (): Promise<any> => apiClient('/admin/odoo/health'),
  getJobs: (): Promise<any[]> => apiClient('/admin/jobs'),
  runJob: (name: string): Promise<any> => apiClient(`/admin/jobs/run/${name}`, { method: 'POST' }),
  getOutbox: (): Promise<any[]> => apiClient('/admin/outbox'),
};

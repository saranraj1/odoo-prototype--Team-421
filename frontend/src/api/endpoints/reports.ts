import { apiClient } from '../client';

export const reportsApi = {
  getSummary: (filters: Record<string, any> = {}): Promise<any> => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/reports/summary?${qs.toString()}`);
  },

  getDeals: (filters: Record<string, any> = {}): Promise<any> => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/reports/deals?${qs.toString()}`);
  },

  getApprovals: (filters: Record<string, any> = {}): Promise<any> => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/reports/approvals?${qs.toString()}`);
  },

  getRisk: (filters: Record<string, any> = {}): Promise<any> => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/reports/risk?${qs.toString()}`);
  },

  exportReport: async (reportType: string, format: 'pdf' | 'xlsx', filters: Record<string, any> = {}): Promise<void> => {
    const qs = new URLSearchParams({ ...filters, format });
    const blob = await apiClient<Blob>(`/reports/${reportType}?${qs.toString()}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dealflow_${reportType}_report.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

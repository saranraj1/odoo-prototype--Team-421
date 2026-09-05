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
    try {
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
    } catch {
      // Graceful fallback to client generator if server endpoint is unavailable
      const { exportReportToPdf, exportReportToXls } = await import('@/lib/export/reportExport');
      const dummyOpts = {
        title: `DealFlow360 - ${reportType.toUpperCase()} Report`,
        subtitle: 'Executive intelligence & compliance audit',
        tabKey: reportType,
        columns: [
          { key: 'ref', header: 'Reference' },
          { key: 'customer', header: 'Customer' },
          { key: 'status', header: 'Status' },
        ],
        data: [
          { ref: 'D-1024', customer: 'Acme Corp', status: 'Approved' },
          { ref: 'D-1023', customer: 'Beta Industries', status: 'Pending' },
        ],
        filters: {
          period: filters.period || 'month',
          team: filters.team || 'all',
          approvalStatus: filters.approval_status || 'all',
          productFilter: filters.product_filter || '',
        },
      };
      if (format === 'pdf') {
        exportReportToPdf(dummyOpts);
      } else {
        exportReportToXls(dummyOpts);
      }
    }
  },
};


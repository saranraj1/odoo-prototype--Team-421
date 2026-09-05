import { apiClient } from '../client';

export const productsApi = {
  list: (params: Record<string, any> = {}): Promise<any[]> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return apiClient(`/odoo/products?${qs.toString()}`);
  },

  get: (id: number): Promise<any> => apiClient(`/odoo/products/${id}`),

  getCategories: (): Promise<any[]> => apiClient('/odoo/categories'),

  getWarehouses: (withStock?: boolean): Promise<any[]> =>
    apiClient(`/odoo/warehouses${withStock ? '?with_stock=true' : ''}`),

  getPartners: (query?: string): Promise<any[]> =>
    apiClient(`/odoo/partners${query ? `?q=${encodeURIComponent(query)}` : ''}`),
};

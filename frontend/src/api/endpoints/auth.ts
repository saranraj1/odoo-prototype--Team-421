import { apiClient } from '../client';
import type { AuthResponse, PortalAuthResponse, AuthUser } from '../types';

export const authApi = {
  login: async (login: string, password: string): Promise<AuthResponse> => {
    const data = await apiClient<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    const user: AuthUser = data.user || {
      id: data.odoo_user_id,
      odoo_user_id: data.odoo_user_id,
      name: data.name,
      role: data.role,
      company_id: 1,
      is_active: true,
    };
    return {
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
      user,
    };
  },

  me: (): Promise<AuthUser> => apiClient('/auth/me'),

  logout: (): Promise<{ message: string }> =>
    apiClient('/auth/logout', { method: 'POST' }),

  portalLogin: async (login: string, password: string): Promise<PortalAuthResponse> => {
    const data = await apiClient<any>('/portal/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    return {
      access_token: data.access_token,
      token_type: data.token_type,
      partner: {
        id: data.partner_id || data.odoo_user_id || 1,
        name: data.name || 'Customer',
      },
    };
  },

  requestMagicLink: (email: string): Promise<void> =>
    apiClient('/portal/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyMagicLink: (token: string): Promise<PortalAuthResponse> =>
    apiClient(`/portal/auth/verify?token=${encodeURIComponent(token)}`),

  exchangeOdooToken: (token: string): Promise<PortalAuthResponse> =>
    apiClient('/portal/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  portalMe: (): Promise<{ id: number; name: string }> => apiClient('/portal/me'),
};

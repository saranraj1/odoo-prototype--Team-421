import { create } from 'zustand';

interface PortalPartner {
  id: number;
  name: string;
}

interface PortalAuthState {
  token: string | null;
  partner: PortalPartner | null;
  isAuthenticated: boolean;
  setAuth: (token: string, partner: PortalPartner) => void;
  clearAuth: () => void;
}

export const usePortalAuthStore = create<PortalAuthState>((set) => {
  const savedToken = sessionStorage.getItem('dealflow_portal_token');
  const savedPartner = sessionStorage.getItem('dealflow_portal_partner');

  return {
    token: savedToken,
    partner: savedPartner ? JSON.parse(savedPartner) : null,
    isAuthenticated: !!savedToken,

    setAuth: (token, partner) => {
      sessionStorage.setItem('dealflow_portal_token', token);
      sessionStorage.setItem('dealflow_portal_partner', JSON.stringify(partner));
      set({ token, partner, isAuthenticated: true });
    },

    clearAuth: () => {
      sessionStorage.removeItem('dealflow_portal_token');
      sessionStorage.removeItem('dealflow_portal_partner');
      set({ token: null, partner: null, isAuthenticated: false });
    },
  };
});

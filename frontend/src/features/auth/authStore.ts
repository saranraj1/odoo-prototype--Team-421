import { create } from 'zustand';
import type { AuthUser } from '@/api/types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const savedToken = sessionStorage.getItem('dealflow_auth_token');
  const savedUser = sessionStorage.getItem('dealflow_auth_user');

  return {
    token: savedToken,
    user: savedUser ? JSON.parse(savedUser) : null,
    isAuthenticated: !!savedToken,

    setAuth: (token, user) => {
      sessionStorage.setItem('dealflow_auth_token', token);
      sessionStorage.setItem('dealflow_auth_user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    },

    clearAuth: () => {
      sessionStorage.removeItem('dealflow_auth_token');
      sessionStorage.removeItem('dealflow_auth_user');
      set({ token: null, user: null, isAuthenticated: false });
    },

    setUser: (user) => {
      sessionStorage.setItem('dealflow_auth_user', JSON.stringify(user));
      set({ user });
    },
  };
});

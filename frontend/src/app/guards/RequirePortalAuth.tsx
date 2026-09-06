import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePortalAuthStore } from '@/features/portal/portalAuthStore';
import { useAuthStore } from '@/features/auth/authStore';

export const RequirePortalAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated: hasPortalAuth } = usePortalAuthStore();
  const { isAuthenticated: hasInternalAuth } = useAuthStore();
  const location = useLocation();

  if (!hasPortalAuth && !hasInternalAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

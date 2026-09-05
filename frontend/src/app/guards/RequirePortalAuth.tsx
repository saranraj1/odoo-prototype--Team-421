import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePortalAuthStore } from '@/features/portal/portalAuthStore';

export const RequirePortalAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = usePortalAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/portal/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

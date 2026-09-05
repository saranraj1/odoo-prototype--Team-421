import React from 'react';
import { useAuthStore } from '@/features/auth/authStore';
import { canAccessRoute, UserRole } from '@/lib/rbac';
import { ForbiddenState } from '@/components/data/ForbiddenState';

export const RequireRole: React.FC<{
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user } = useAuthStore();

  if (!user || !canAccessRoute(user.role as UserRole, allowedRoles)) {
    return <ForbiddenState requiredRoles={allowedRoles} userRole={user?.role} />;
  }

  return <>{children}</>;
};

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserAccount, UserRole } from '../../types';
import { AuthService } from '../../security/authService';

interface RoleContextValue {
  currentUser: UserAccount | null;
  activeRole: UserRole | null;
  roleTitle: string;
  isCustomer: boolean;
  isApprover: boolean;
  isSalesRep: boolean;
  isSalesManager: boolean;
  isFinanceDirector: boolean;
  isAdmin: boolean;
  requiresAssignment: boolean;
  isValidatingSession: boolean;
  setAuthenticatedUser: (user: UserAccount | null) => void;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isValidatingSession, setIsValidatingSession] = useState<boolean>(true);

  // Authoritative session verification on application mount
  const refreshSession = useCallback(async () => {
    setIsValidatingSession(true);
    try {
      const verified = await AuthService.getAuthenticatedSession();
      setCurrentUser(verified);
    } catch (e) {
      console.error('[AUTH] Failed to verify session:', e);
      setCurrentUser(null);
    } finally {
      setIsValidatingSession(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const activeRole: UserRole | null = currentUser ? currentUser.role : null;

  const getTitle = (role: UserRole | null) => {
    switch (role) {
      case 'SALES_REP': return 'Sales Representative';
      case 'SALES_MANAGER': return 'Sales Manager (Customer Classification & L1 Approval)';
      case 'FINANCE_DIRECTOR': return 'Finance Director (Executive Governance & L2 Approval)';
      case 'ADMIN': return 'System Administrator (Users, Fulfillment & Platform Analytics)';
      case 'CUSTOMER': return 'B2B Customer Portal';
      default: return 'Unauthenticated Guest';
    }
  };

  const setAuthenticatedUser = (user: UserAccount | null) => {
    setCurrentUser(user);
  };

  /**
   * Secure Logout: Invalidate session, clear memory, and redirect to appropriate login route
   */
  const logout = useCallback(() => {
    const wasCustomer = currentUser?.role === 'CUSTOMER';
    AuthService.logout();
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      window.location.hash = wasCustomer ? '/customer-login' : '/enterprise-login';
    }
  }, [currentUser]);

  const requiresAssignment = currentUser?.role !== 'CUSTOMER' && currentUser?.assignmentStatus === 'PENDING';

  return (
    <RoleContext.Provider
      value={{
        currentUser,
        activeRole,
        roleTitle: getTitle(activeRole),
        isCustomer: activeRole === 'CUSTOMER',
        isApprover: activeRole === 'SALES_MANAGER' || activeRole === 'FINANCE_DIRECTOR' || activeRole === 'ADMIN',
        isSalesRep: activeRole === 'SALES_REP',
        isSalesManager: activeRole === 'SALES_MANAGER',
        isFinanceDirector: activeRole === 'FINANCE_DIRECTOR',
        isAdmin: activeRole === 'ADMIN',
        requiresAssignment: !!requiresAssignment,
        isValidatingSession,
        setAuthenticatedUser,
        logout,
        refreshSession,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

import React, { useState, useEffect, useCallback } from 'react';
import { RoleProvider, useRole } from './app/providers/RoleContext';
import { DealFlowProvider } from './app/providers/DealFlowContext';
import { HeaderNavbar } from './components/navigation/HeaderNavbar';
import { QuoteBuilder } from './components/quotation/QuoteBuilder';
import { ControlTower } from './components/dashboard/ControlTower';
import { ApprovalCenter } from './components/approvals/ApprovalCenter';
import { CustomerPortalView } from './components/portal/CustomerPortalView';
import { FulfillmentView } from './components/fulfillment/FulfillmentView';
import { BillingView } from './components/billing/BillingView';
import { DealPipelineKanban } from './components/pipeline/DealPipelineKanban';
import { DealsList } from './components/deals/DealsList';
import { AdminConfigView } from './components/admin/AdminConfigView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { CustomerClassificationView } from './components/manager/CustomerClassificationView';
import { EnterpriseLogin } from './components/auth/EnterpriseLogin';
import { CustomerLogin } from './components/auth/CustomerLogin';
import { AccessPendingView } from './components/auth/AccessPendingView';
import { ForbiddenView } from './components/auth/ForbiddenView';

const MainContent: React.FC = () => {
  const { 
    currentUser, 
    isCustomer, 
    isSalesRep,
    isSalesManager,
    isFinanceDirector,
    isAdmin,
    requiresAssignment, 
    isValidatingSession 
  } = useRole();

  const [currentTab, setCurrentTab] = useState<string>('cockpit');
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash.replace(/^#/, '') || '/';
    }
    return '/';
  });

  // Track browser URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const raw = window.location.hash.replace(/^#/, '') || '/';
      setCurrentRoute(raw);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = useCallback((path: string) => {
    window.location.hash = path;
    setCurrentRoute(path);
  }, []);

  const handleSelectDeal = () => {
    setCurrentTab('cockpit');
  };

  // 1. Session Validation Loading State
  if (isValidatingSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-400 tracking-wider uppercase">
          Verifying Authenticated Session...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated State: Route to separate login portals
  if (!currentUser) {
    const isCustomerLoginRoute = currentRoute.includes('customer');
    if (isCustomerLoginRoute) {
      return (
        <CustomerLogin
          onSuccess={() => navigateTo('/customer')}
          onGoToEnterpriseLogin={() => navigateTo('/enterprise-login')}
        />
      );
    }
    return (
      <EnterpriseLogin
        onSuccess={() => {
          // Dynamic redirect will occur after role resolution
        }}
        onGoToCustomerLogin={() => navigateTo('/customer-login')}
      />
    );
  }

  // 3. Gated Admin Assignment Check
  if (requiresAssignment) {
    return <AccessPendingView />;
  }

  // 4. Role-Based Route Guards & 403 Forbidden Detection
  const isCustomerRoute = currentRoute.startsWith('/customer');
  const isAdminRoute = currentRoute.startsWith('/admin');
  const isManagerRoute = currentRoute.startsWith('/manager');
  const isSalesRoute = currentRoute.startsWith('/sales');
  const isDashboardRoute = currentRoute.startsWith('/dashboard');

  // CUSTOMER ACCESSING ENTERPRISE ROUTES -> 403 FORBIDDEN
  if (isCustomer && (isAdminRoute || isManagerRoute || isSalesRoute || isDashboardRoute)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        <HeaderNavbar currentTab={currentTab} setCurrentTab={setCurrentTab} />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <ForbiddenView
            requestedPath={currentRoute}
            onReturnToHome={() => navigateTo('/customer')}
          />
        </main>
      </div>
    );
  }

  // SALES REP ACCESSING ADMIN OR CUSTOMER ROUTES -> 403 FORBIDDEN
  if (isSalesRep && (isAdminRoute || isCustomerRoute)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        <HeaderNavbar currentTab={currentTab} setCurrentTab={setCurrentTab} />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <ForbiddenView
            requestedPath={currentRoute}
            onReturnToHome={() => navigateTo('/sales')}
          />
        </main>
      </div>
    );
  }

  // SALES MANAGER ACCESSING ADMIN USER MGMT OR CUSTOMER ROUTES -> 403 FORBIDDEN
  if (isSalesManager && (isAdminRoute || isCustomerRoute)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        <HeaderNavbar currentTab={currentTab} setCurrentTab={setCurrentTab} />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <ForbiddenView
            requestedPath={currentRoute}
            onReturnToHome={() => navigateTo('/manager')}
          />
        </main>
      </div>
    );
  }

  // 5. Main Authenticated Application Render
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <HeaderNavbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* B2B Customer Portal (Customer Only) */}
        {isCustomer ? (
          <CustomerPortalView />
        ) : (
          <>
            {currentTab === 'cockpit' && (
              <QuoteBuilder onNavigateTab={setCurrentTab} />
            )}

            {currentTab === 'control-tower' && (
              <ControlTower
                onSelectDeal={handleSelectDeal}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'approvals' && (
              <ApprovalCenter
                onOpenCockpit={handleSelectDeal}
              />
            )}

            {currentTab === 'customers-tiers' && (
              <CustomerClassificationView />
            )}

            {currentTab === 'deals-list' && (
              <DealsList onSelectDeal={handleSelectDeal} />
            )}

            {currentTab === 'pipeline' && (
              <DealPipelineKanban onSelectDeal={handleSelectDeal} />
            )}

            {currentTab === 'fulfillment' && (
              <FulfillmentView />
            )}

            {currentTab === 'billing' && (
              <BillingView />
            )}

            {currentTab === 'admin-dashboard' && (
              <AdminDashboard />
            )}

            {currentTab === 'admin-config' && (
              <AdminConfigView />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <RoleProvider>
      <DealFlowProvider>
        <MainContent />
      </DealFlowProvider>
    </RoleProvider>
  );
}

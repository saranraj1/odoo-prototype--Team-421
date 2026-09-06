import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router-dom';
import { InternalLayout } from './layouts/InternalLayout';
import { PortalLayout } from './layouts/PortalLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { RequirePortalAuth } from './guards/RequirePortalAuth';

// Landing Page
import { LandingPage } from '@/features/landing/LandingPage';

// Auth
import { LoginPage } from '@/features/auth/LoginPage';
import { PortalVerifyPage } from '@/features/portal/PortalVerifyPage';

// Dashboards
import { SalesDashboardPage } from '@/features/dashboard/SalesDashboardPage';
import { ControlTowerPage } from '@/features/dashboard/ControlTowerPage';
import { OperationsDashboardPage } from '@/features/dashboard/OperationsDashboardPage';

// Quotations
import { QuotationsListPage } from '@/features/quotations/QuotationsListPage';
import { NewQuotationPage } from '@/features/quotations/NewQuotationPage';
import { QuotationWorkspacePage } from '@/features/quotations/QuotationWorkspacePage';
import { AssessmentDetailPage } from '@/features/guardian/AssessmentDetailPage';

// Approvals
import { ApprovalsListPage } from '@/features/approvals/ApprovalsListPage';
import { ApprovalDetailPage } from '@/features/approvals/ApprovalDetailPage';

// Fulfillment
import { FulfillmentListPage } from '@/features/fulfillment/FulfillmentListPage';
import { FulfillmentDetailPage } from '@/features/fulfillment/FulfillmentDetailPage';

// Subscriptions & Billing
import { SubscriptionsListPage } from '@/features/subscriptions/SubscriptionsListPage';
import { BillingDetailPage } from '@/features/billing/BillingDetailPage';

// Invoices
import { InvoicesListPage } from '@/features/invoices/InvoicesListPage';
import { InvoiceDetailPage } from '@/features/invoices/InvoiceDetailPage';

// Health & Reports
import { DealHealthPage } from '@/features/health/DealHealthPage';
import { ReportsPage } from '@/features/reports/ReportsPage';

// Products
import { ProductCatalogPage } from '@/features/products/ProductCatalogPage';
import { ProductDetailPage } from '@/features/products/ProductDetailPage';

// Config
import { ConfigLayout } from '@/features/config/ConfigLayout';

// Portal
import { PortalQuotationsListPage } from '@/features/portal/PortalQuotationsListPage';
import { PortalNegotiationPage } from '@/features/portal/PortalNegotiationPage';
import { PortalMessagesPage } from '@/features/portal/PortalMessagesPage';
import { PortalProfilePage } from '@/features/portal/PortalProfilePage';

import { useAuthStore } from '@/features/auth/authStore';
import { RouteErrorBoundary } from '@/components/feedback/RouteErrorBoundary';

const DashboardRouter: React.FC = () => {
  const { user } = useAuthStore();
  if (user?.role === 'CUSTOMER') return <Navigate to="/portal/quotations" replace />;
  if (user?.role === 'SALES_MANAGER' || user?.role === 'ADMIN') return <ControlTowerPage />;
  if (user?.role === 'FINANCE' || user?.role === 'FINANCE_DIRECTOR') return <OperationsDashboardPage />;
  return <SalesDashboardPage />;
};

const RootShell: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  // If visitor is at root "/" and not authenticated, display the Landing Page!
  if (!isAuthenticated && location.pathname === '/') {
    return <LandingPage />;
  }

  // If authenticated, render internal authenticated layout
  return (
    <RequireAuth>
      <InternalLayout />
    </RequireAuth>
  );
};

export const router = createBrowserRouter([
  // Standalone Public Landing Page
  {
    path: '/landing',
    element: <LandingPage />,
    errorElement: <RouteErrorBoundary />,
  },

  // Internal Auth
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/enterprise-login', element: <LoginPage /> },
    ],
  },

  // Internal Shell
  {
    path: '/',
    element: <RootShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DashboardRouter /> },
      { path: 'quotations', element: <QuotationsListPage /> },
      { path: 'quotations/new', element: <NewQuotationPage /> },
      { path: 'quotations/:id', element: <QuotationWorkspacePage /> },
      { path: 'quotations/:id/assessments/:aid', element: <AssessmentDetailPage /> },
      { path: 'approvals', element: <ApprovalsListPage /> },
      { path: 'approvals/:dealId', element: <ApprovalDetailPage /> },
      { path: 'fulfillment', element: <FulfillmentListPage /> },
      { path: 'fulfillment/:dealId', element: <FulfillmentDetailPage /> },
      { path: 'subscriptions', element: <SubscriptionsListPage /> },
      { path: 'billing/:dealId', element: <BillingDetailPage /> },
      { path: 'invoices', element: <InvoicesListPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'deal-health', element: <DealHealthPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'products', element: <ProductCatalogPage /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
      {
        path: 'config/*',
        element: (
          <RequireRole allowedRoles={['ADMIN', 'SALES_MANAGER']}>
            <ConfigLayout />
          </RequireRole>
        ),
      },
    ],
  },

  // Portal Auth Redirects
  {
    path: '/portal/login',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/customer-login',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/portal/verify',
    element: <PortalVerifyPage />,
  },

  // Portal Shell
  {
    path: '/portal',
    element: (
      <RequirePortalAuth>
        <PortalLayout />
      </RequirePortalAuth>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/portal/quotations" replace /> },
      { path: 'quotations', element: <PortalQuotationsListPage /> },
      { path: 'quotations/:id', element: <PortalNegotiationPage /> },
      { path: 'messages', element: <PortalMessagesPage /> },
      { path: 'profile', element: <PortalProfilePage /> },
    ],
  },

  // Fallback
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};

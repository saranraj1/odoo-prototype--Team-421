export type UserRole = 'ADMIN' | 'SALES_MANAGER' | 'SALES_REP' | 'FINANCE' | 'FINANCE_DIRECTOR' | 'CUSTOMER';

export interface NavTab {
  label: string;
  path: string;
  allowedRoles: UserRole[];
}

export const ROLE_NAV_CONFIG: Record<UserRole, NavTab[]> = {
  SALES_REP: [
    { label: 'Sales Dashboard', path: '/', allowedRoles: ['SALES_REP'] },
    { label: 'Deals & Pipeline', path: '/quotations', allowedRoles: ['SALES_REP'] },
    { label: 'Approval Status', path: '/approvals', allowedRoles: ['SALES_REP'] },
    { label: 'Fulfillment Status', path: '/fulfillment', allowedRoles: ['SALES_REP'] },
    { label: 'Billing & Subscriptions', path: '/subscriptions', allowedRoles: ['SALES_REP'] },
  ],
  SALES_MANAGER: [
    { label: 'Control Tower', path: '/', allowedRoles: ['SALES_MANAGER'] },
    { label: 'Approval Queue', path: '/approvals', allowedRoles: ['SALES_MANAGER'] },
    { label: 'Deals & Quotes', path: '/quotations', allowedRoles: ['SALES_MANAGER'] },
    { label: 'Deal Health', path: '/deal-health', allowedRoles: ['SALES_MANAGER'] },
    { label: 'Reports', path: '/reports', allowedRoles: ['SALES_MANAGER'] },
    { label: 'Policies & Config', path: '/config', allowedRoles: ['SALES_MANAGER'] },
  ],
  FINANCE: [
    { label: 'Operations Dashboard', path: '/', allowedRoles: ['FINANCE'] },
    { label: 'Finance Approvals', path: '/approvals', allowedRoles: ['FINANCE'] },
    { label: 'Fulfillment & Routing', path: '/fulfillment', allowedRoles: ['FINANCE'] },
    { label: 'Subscriptions', path: '/subscriptions', allowedRoles: ['FINANCE'] },
    { label: 'Invoices', path: '/invoices', allowedRoles: ['FINANCE'] },
    { label: 'Deal Health', path: '/deal-health', allowedRoles: ['FINANCE'] },
    { label: 'Reports', path: '/reports', allowedRoles: ['FINANCE'] },
  ],
  FINANCE_DIRECTOR: [
    { label: 'Operations Dashboard', path: '/', allowedRoles: ['FINANCE_DIRECTOR'] },
    { label: 'Finance Approvals', path: '/approvals', allowedRoles: ['FINANCE_DIRECTOR'] },
    { label: 'Fulfillment & Routing', path: '/fulfillment', allowedRoles: ['FINANCE_DIRECTOR'] },
    { label: 'Subscriptions', path: '/subscriptions', allowedRoles: ['FINANCE_DIRECTOR'] },
    { label: 'Invoices', path: '/invoices', allowedRoles: ['FINANCE_DIRECTOR'] },
    { label: 'Deal Health', path: '/deal-health', allowedRoles: ['FINANCE_DIRECTOR'] },
    { label: 'Reports', path: '/reports', allowedRoles: ['FINANCE_DIRECTOR'] },
  ],
  ADMIN: [
    { label: 'Admin Dashboard', path: '/', allowedRoles: ['ADMIN'] },
    { label: 'Deals & Quotes', path: '/quotations', allowedRoles: ['ADMIN'] },
    { label: 'Approvals', path: '/approvals', allowedRoles: ['ADMIN'] },
    { label: 'Fulfillment', path: '/fulfillment', allowedRoles: ['ADMIN'] },
    { label: 'Subscriptions', path: '/subscriptions', allowedRoles: ['ADMIN'] },
    { label: 'Invoices', path: '/invoices', allowedRoles: ['ADMIN'] },
    { label: 'Products', path: '/products', allowedRoles: ['ADMIN'] },
    { label: 'Reports', path: '/reports', allowedRoles: ['ADMIN'] },
    { label: 'Platform Config', path: '/config', allowedRoles: ['ADMIN'] },
  ],
  CUSTOMER: [
    { label: 'My Quotations', path: '/portal/quotations', allowedRoles: ['CUSTOMER'] },
    { label: 'Order History & Account', path: '/portal/profile', allowedRoles: ['CUSTOMER'] },
    { label: 'Messages & Activity', path: '/portal/messages', allowedRoles: ['CUSTOMER'] },
  ],
};

export const INTERNAL_NAV_TABS: NavTab[] = [
  { label: 'Dashboard', path: '/', allowedRoles: ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE', 'FINANCE_DIRECTOR'] },
  { label: 'Quotations', path: '/quotations', allowedRoles: ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE', 'FINANCE_DIRECTOR'] },
  { label: 'Approvals', path: '/approvals', allowedRoles: ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE', 'FINANCE_DIRECTOR'] },
  { label: 'Fulfillment', path: '/fulfillment', allowedRoles: ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE', 'FINANCE_DIRECTOR'] },
  { label: 'Subscriptions', path: '/subscriptions', allowedRoles: ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE', 'FINANCE_DIRECTOR'] },
  { label: 'Invoices', path: '/invoices', allowedRoles: ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE', 'FINANCE_DIRECTOR'] },
  { label: 'Deal Health', path: '/deal-health', allowedRoles: ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE', 'FINANCE_DIRECTOR'] },
  { label: 'Reports', path: '/reports', allowedRoles: ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE', 'FINANCE_DIRECTOR'] },
  { label: 'Products', path: '/products', allowedRoles: ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE', 'FINANCE_DIRECTOR'] },
  { label: 'Config', path: '/config', allowedRoles: ['ADMIN', 'SALES_MANAGER'] },
];

export const PORTAL_NAV_TABS: NavTab[] = [
  { label: 'My Quotations', path: '/portal/quotations', allowedRoles: ['CUSTOMER'] },
  { label: 'Order History & Account', path: '/portal/profile', allowedRoles: ['CUSTOMER'] },
  { label: 'Messages & Activity', path: '/portal/messages', allowedRoles: ['CUSTOMER'] },
];

export function getTabsForRole(role: UserRole | undefined): NavTab[] {
  if (!role) return [];
  return ROLE_NAV_CONFIG[role] || ROLE_NAV_CONFIG.SALES_REP;
}

export function canAccessRoute(role: UserRole | undefined, allowedRoles: UserRole[]): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  if (role === 'FINANCE_DIRECTOR' && allowedRoles.includes('FINANCE')) return true;
  if (role === 'FINANCE' && allowedRoles.includes('FINANCE_DIRECTOR')) return true;
  return allowedRoles.includes(role);
}

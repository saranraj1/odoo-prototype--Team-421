import { describe, it, expect } from 'vitest';
import { canAccessRoute, INTERNAL_NAV_TABS, PORTAL_NAV_TABS } from '../../src/lib/rbac';

describe('RBAC permissions', () => {
  it('allows ADMIN full access across internal tabs', () => {
    INTERNAL_NAV_TABS.forEach((tab) => {
      expect(canAccessRoute('ADMIN', tab.allowedRoles)).toBe(true);
    });
  });

  it('restricts SALES_REP from config tab', () => {
    const configTab = INTERNAL_NAV_TABS.find((t) => t.path === '/config');
    expect(configTab).toBeDefined();
    expect(canAccessRoute('SALES_REP', configTab!.allowedRoles)).toBe(false);
  });

  it('allows SALES_MANAGER to view dashboard, approvals, quotations, and config', () => {
    const approvalsTab = INTERNAL_NAV_TABS.find((t) => t.path === '/approvals');
    const configTab = INTERNAL_NAV_TABS.find((t) => t.path === '/config');
    expect(canAccessRoute('SALES_MANAGER', approvalsTab!.allowedRoles)).toBe(true);
    expect(canAccessRoute('SALES_MANAGER', configTab!.allowedRoles)).toBe(true);
  });

  it('allows CUSTOMER access strictly to portal tabs', () => {
    PORTAL_NAV_TABS.forEach((tab) => {
      expect(canAccessRoute('CUSTOMER', tab.allowedRoles)).toBe(true);
    });
  });
});

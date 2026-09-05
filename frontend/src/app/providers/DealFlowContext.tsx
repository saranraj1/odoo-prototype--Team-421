import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  AuditTimelineItem,
  DealContext,
  FulfillmentPlan,
  GuardianEvaluationResult,
  LineItem,
  AccretiveRecommendation,
  ApprovedBaseline,
  CustomerRecord,
  CustomerTier,
  UserAccount,
} from '../../types';
import { INITIAL_SEED_DEALS } from '../../data/seedDeals';
import { INITIAL_CUSTOMERS } from '../../data/customers';
import { CATALOG_PRODUCTS } from '../../data/catalog';
import { evaluateDealGuardian, calculateCommercialTotals } from '../../engine/riskEngine';
import { calculateFulfillmentPlan } from '../../engine/fulfillmentEngine';
import { getAccretiveRecommendations } from '../../engine/recommendationEngine';
import { detectMaterialInvalidation } from '../../engine/invalidationEngine';
import { validateCustomerTierDiscount } from '../../engine/policyEngine';
import { AuthService } from '../../security/authService';
import { RBAC } from '../../security/rbac';

interface DealFlowContextValue {
  deals: DealContext[];
  activeDealId: string;
  setActiveDealId: (id: string) => void;
  activeDeal: DealContext;
  customers: CustomerRecord[];
  activeCustomer: CustomerRecord | undefined;
  evaluation: GuardianEvaluationResult;
  fulfillmentPlan: FulfillmentPlan;
  recommendations: AccretiveRecommendation[];
  auditLogs: AuditTimelineItem[];
  allEvaluations: Record<string, GuardianEvaluationResult>;
  users: UserAccount[];
  discountErrorToast: string | null;
  clearDiscountError: () => void;
  
  // Actions
  updateLineDiscount: (dealId: string, lineId: string, discount: number) => boolean;
  updateLineQuantity: (dealId: string, lineId: string, qty: number) => void;
  addLineFromRecommendation: (dealId: string, rec: AccretiveRecommendation) => void;
  addProductToDeal: (dealId: string, productId: string) => void;
  removeLineItem: (dealId: string, lineId: string) => void;
  submitForApproval: (dealId: string, role: 'SALES_MANAGER' | 'FINANCE_DIRECTOR') => void;
  approveDeal: (dealId: string, approverRole: 'SALES_MANAGER' | 'FINANCE_DIRECTOR', comments: string) => void;
  rejectDeal: (dealId: string, approverRole: string, reason: string) => void;
  submitCustomerNegotiation: (dealId: string, proposedDiscount: number, comments: string) => void;
  confirmOrderInOdoo: (dealId: string) => void;
  updateFulfillmentLine: (dealId: string, productId: string, fromMain: number, fromEast: number) => void;
  acceptFulfillmentPlan: (dealId: string) => void;
  resetDemoToGoldenPath: () => void;

  // Sales Manager Customer Classification
  updateCustomerClassification: (customerId: string, newTier: CustomerTier, managerName: string) => void;

  // Admin User & Work Assignment Management
  assignUserAccess: (userId: string) => void;
  revokeUserAccess: (userId: string) => void;
  toggleUserActiveStatus: (userId: string) => void;
}

const STORAGE_KEY = 'dealflow360_deals_v3';
const AUDIT_STORAGE_KEY = 'dealflow360_audit_v3';
const CUSTOMERS_STORAGE_KEY = 'dealflow360_customers_v3';

const INITIAL_AUDIT_LOGS: AuditTimelineItem[] = [
  {
    id: 'audit-1',
    dealId: 'deal-acme-1024',
    timestamp: '2026-09-05T09:00:00Z',
    actor: 'Rahul Sharma',
    actorRole: 'Sales Representative',
    eventType: 'CREATED',
    summary: 'Draft quotation initiated from Odoo CRM opportunity #OPP-421',
    details: 'Initial configuration with 10 Enterprise Laptops and SLA Support.',
    badgeVariant: 'neutral',
  },
  {
    id: 'audit-2',
    dealId: 'deal-acme-1024',
    timestamp: '2026-09-05T09:15:00Z',
    actor: 'Sunita Nair',
    actorRole: 'Sales Manager',
    eventType: 'TIER_CHANGED',
    summary: 'Customer Acme Corp classified as GOLD Tier (Max 15.0% discount)',
    details: 'Verified commercial account expansion potential.',
    badgeVariant: 'success',
  },
  {
    id: 'audit-3',
    dealId: 'deal-acme-1024',
    timestamp: '2026-09-05T09:20:00Z',
    actor: 'Deal Guardian',
    actorRole: 'Governance Engine',
    eventType: 'RISK_EVALUATED',
    summary: 'Baseline risk score evaluated at 12/100 (SAFE)',
    details: 'All line discounts within authorized Gold tier guidelines.',
    badgeVariant: 'success',
  },
];

const DealFlowContext = createContext<DealFlowContextValue | undefined>(undefined);

export const DealFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deals, setDeals] = useState<DealContext[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading deals', e);
    }
    return INITIAL_SEED_DEALS;
  });

  const [customers, setCustomers] = useState<CustomerRecord[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading customers', e);
    }
    return INITIAL_CUSTOMERS;
  });

  const [activeDealId, setActiveDealId] = useState<string>('deal-acme-1024');
  const [discountErrorToast, setDiscountErrorToast] = useState<string | null>(null);
  const [users, setUsers] = useState<UserAccount[]>(() => AuthService.getAllUsers());

  const [auditLogs, setAuditLogs] = useState<AuditTimelineItem[]>(() => {
    try {
      const saved = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading audit', e);
    }
    return INITIAL_AUDIT_LOGS;
  });

  const persistDeals = (newDeals: DealContext[]) => {
    setDeals(newDeals);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newDeals));
  };

  const persistCustomers = (newCustomers: CustomerRecord[]) => {
    setCustomers(newCustomers);
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(newCustomers));
  };

  const addAuditEntry = (entry: Omit<AuditTimelineItem, 'id' | 'timestamp'>) => {
    const newEntry: AuditTimelineItem = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => {
      const updated = [newEntry, ...prev];
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const sessionUser = AuthService.getCachedUser();

  // Strict tenant and assignment isolation
  const visibleDeals = useMemo(() => {
    if (!sessionUser) return deals;
    if (sessionUser.role === 'CUSTOMER') {
      return deals.filter(d => d.customerId === sessionUser.customerId);
    }
    if (sessionUser.role === 'SALES_REP') {
      return deals.filter(d => RBAC.canAccessDeal(sessionUser, d));
    }
    return deals;
  }, [deals, sessionUser]);

  const activeDeal = useMemo(() => {
    if (sessionUser && sessionUser.role === 'CUSTOMER') {
      const myDeal = deals.find(d => d.customerId === sessionUser.customerId && d.id === activeDealId) 
        || deals.find(d => d.customerId === sessionUser.customerId) 
        || deals[0];
      return myDeal;
    }
    return deals.find((d) => d.id === activeDealId) || deals[0];
  }, [deals, activeDealId, sessionUser]);

  const activeCustomer = useMemo(() => {
    return customers.find((c) => c.id === activeDeal.customerId);
  }, [customers, activeDeal]);

  // Evaluated states for all deals
  const allEvaluations = useMemo(() => {
    const map: Record<string, GuardianEvaluationResult> = {};
    for (const d of deals) {
      map[d.id] = evaluateDealGuardian(d);
    }
    return map;
  }, [deals]);

  const evaluation = useMemo(() => {
    return allEvaluations[activeDeal.id] || evaluateDealGuardian(activeDeal);
  }, [allEvaluations, activeDeal]);

  const fulfillmentPlan = useMemo(() => {
    return calculateFulfillmentPlan(activeDeal.id, activeDeal.lines);
  }, [activeDeal]);

  const recommendations = useMemo(() => {
    return getAccretiveRecommendations(activeDeal);
  }, [activeDeal]);

  const clearDiscountError = () => setDiscountErrorToast(null);

  /**
   * STRICT DISCOUNT ENFORCEMENT
   * Customer Tier Rules:
   * GOLD   -> Max 15%
   * SILVER -> Max 10%
   * BRONZE -> Max 5%
   * Rejects exceeding discounts immediately with explicit error.
   */
  const updateLineDiscount = (dealId: string, lineId: string, discount: number): boolean => {
    const targetDeal = deals.find((d) => d.id === dealId);
    if (!targetDeal) return false;

    // Authoritative session & RBAC verification
    const session = AuthService.getCachedUser();
    if (!session) {
      setDiscountErrorToast('Unauthorized (401): Active authentication session required.');
      return false;
    }

    if (session.role === 'CUSTOMER') {
      setDiscountErrorToast('Forbidden (403): Customer accounts cannot alter internal quotation discounts.');
      return false;
    }

    if (!RBAC.canModifyQuote(session, targetDeal)) {
      setDiscountErrorToast('Forbidden (403): You do not have authorization to edit pricing on this quotation.');
      return false;
    }

    const validDiscount = Math.max(0, Number(discount) || 0);

    // Strict customer tier validation
    const validation = validateCustomerTierDiscount(targetDeal.customerTier, validDiscount);
    if (!validation.isValid) {
      setDiscountErrorToast(validation.errorMessage || 'Discount exceeds customer tier limit.');
      return false; // REJECTED
    }

    // Clear previous errors if valid
    setDiscountErrorToast(null);

    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;

      const updatedLines = d.lines.map((line) => {
        if (line.id === lineId) {
          return { ...line, discountPercent: validDiscount };
        }
        return line;
      });

      let newState = d.state;
      if (d.approvedBaseline) {
        const invalidation = detectMaterialInvalidation(d.approvedBaseline, updatedLines);
        if (invalidation.isInvalidated && (d.state === 'APPROVED' || d.state === 'CONFIRMED')) {
          newState = 'INVALIDATED';
        }
      }

      return {
        ...d,
        lines: updatedLines,
        state: newState,
        version: d.version + 1,
        lastActivityDate: new Date().toISOString(),
      };
    });

    persistDeals(updatedDeals);

    const changedLine = targetDeal.lines.find((l) => l.id === lineId);
    addAuditEntry({
      dealId,
      actor: 'Rahul Sharma',
      actorRole: 'Sales Representative',
      eventType: 'DISCOUNT_UPDATED',
      summary: `Discount updated to ${validDiscount.toFixed(1)}% on ${changedLine?.name || 'Line'}`,
      details: `Validated against ${targetDeal.customerTier} tier ceiling (Max ${validation.tierLimit.toFixed(1)}%). Remaining capacity: ${validation.remainingCapacity.toFixed(1)}%.`,
      badgeVariant: validDiscount > 10 ? 'warning' : 'neutral',
    });

    return true;
  };

  const updateLineQuantity = (dealId: string, lineId: string, qty: number) => {
    const validQty = Math.max(1, Math.round(Number(qty) || 1));

    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;
      return {
        ...d,
        lines: d.lines.map((l) => (l.id === lineId ? { ...l, quantity: validQty } : l)),
        version: d.version + 1,
        lastActivityDate: new Date().toISOString(),
      };
    });

    persistDeals(updatedDeals);
  };

  const addLineFromRecommendation = (dealId: string, rec: AccretiveRecommendation) => {
    const newLine: LineItem = {
      id: `line-${Date.now()}`,
      productId: rec.productId,
      name: rec.productName,
      category: rec.category,
      unitPrice: rec.unitPrice,
      costPrice: rec.costPrice,
      quantity: rec.recommendedQty,
      discountPercent: 0,
    };

    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;
      return {
        ...d,
        lines: [...d.lines, newLine],
        version: d.version + 1,
        lastActivityDate: new Date().toISOString(),
      };
    });

    persistDeals(updatedDeals);

    addAuditEntry({
      dealId,
      actor: 'Rahul Sharma',
      actorRole: 'Sales Representative',
      eventType: 'CREATED',
      summary: `Accretive recommendation added: ${rec.productName} (Qty: ${rec.recommendedQty})`,
      details: `Projected gross margin recovery: +₹${rec.projectedMarginAmount.toLocaleString('en-IN')}`,
      badgeVariant: 'success',
    });
  };

  const addProductToDeal = (dealId: string, productId: string) => {
    const catalogItem = CATALOG_PRODUCTS.find((p) => p.id === productId);
    if (!catalogItem) return;

    const newLine: LineItem = {
      id: `line-${Date.now()}`,
      productId: catalogItem.id,
      name: catalogItem.name,
      category: catalogItem.category,
      unitPrice: catalogItem.unitPrice,
      costPrice: catalogItem.costPrice,
      quantity: 1,
      discountPercent: 0,
      isSubscription: catalogItem.isSubscription,
      billingPeriod: catalogItem.billingPeriod,
    };

    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;
      return {
        ...d,
        lines: [...d.lines, newLine],
        version: d.version + 1,
        lastActivityDate: new Date().toISOString(),
      };
    });

    persistDeals(updatedDeals);
  };

  const removeLineItem = (dealId: string, lineId: string) => {
    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;
      return {
        ...d,
        lines: d.lines.filter((l) => l.id !== lineId),
        version: d.version + 1,
        lastActivityDate: new Date().toISOString(),
      };
    });
    persistDeals(updatedDeals);
  };

  const submitForApproval = (dealId: string, role: 'SALES_MANAGER' | 'FINANCE_DIRECTOR') => {
    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;
      const nextState = role === 'FINANCE_DIRECTOR' ? 'PENDING_FINANCE' : 'PENDING_MANAGER';
      return {
        ...d,
        state: nextState as DealContext['state'],
        lastActivityDate: new Date().toISOString(),
      };
    });

    persistDeals(updatedDeals);

    addAuditEntry({
      dealId,
      actor: 'Rahul Sharma',
      actorRole: 'Sales Representative',
      eventType: 'APPROVAL_REQUESTED',
      summary: `Deal submitted for ${role === 'FINANCE_DIRECTOR' ? 'Finance Executive' : 'Sales Manager'} approval`,
      details: `Commercial terms routed to Control Tower for governance sign-off.`,
      badgeVariant: 'warning',
    });
  };

  const approveDeal = (
    dealId: string,
    approverRole: 'SALES_MANAGER' | 'FINANCE_DIRECTOR',
    comments: string
  ) => {
    const targetDeal = deals.find((d) => d.id === dealId);
    if (!targetDeal) return;

    // Authoritative approval authorization verification
    const session = AuthService.getCachedUser();
    if (!session || (!RBAC.canApproveL1(session) && !RBAC.canApproveL2(session))) {
      console.warn('[SECURITY] Unauthorized approval attempt rejected.');
      return;
    }

    const totals = calculateCommercialTotals(targetDeal.lines);

    const baseline: ApprovedBaseline = {
      capturedAt: new Date().toISOString(),
      approvedBy: approverRole === 'FINANCE_DIRECTOR' ? 'Vikram Malhotra (Finance VP)' : 'Sunita Nair (Sales Manager)',
      role: approverRole,
      netTotal: totals.netTotal,
      marginPercent: totals.marginPercent,
      lines: targetDeal.lines.map((l) => ({
        lineId: l.id,
        productId: l.productId,
        quantity: l.quantity,
        discountPercent: l.discountPercent,
        unitPrice: l.unitPrice,
      })),
    };

    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;
      return {
        ...d,
        state: 'APPROVED' as DealContext['state'],
        approvedBaseline: baseline,
        negotiationActive: false,
        lastActivityDate: new Date().toISOString(),
      };
    });

    persistDeals(updatedDeals);

    addAuditEntry({
      dealId,
      actor: baseline.approvedBy,
      actorRole: approverRole === 'FINANCE_DIRECTOR' ? 'Finance Director' : 'Sales Manager',
      eventType: 'APPROVED',
      summary: `Strategic concession approved (${approverRole === 'FINANCE_DIRECTOR' ? 'Finance Tier' : 'Manager Tier'})`,
      details: `Immutable baseline locked at ${totals.marginPercent.toFixed(1)}% gross margin. Note: ${comments || 'Strategic customer relationship concession approved.'}`,
      badgeVariant: 'success',
    });
  };

  const rejectDeal = (dealId: string, approverRole: string, reason: string) => {
    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;
      return {
        ...d,
        state: 'REJECTED' as DealContext['state'],
        lastActivityDate: new Date().toISOString(),
      };
    });

    persistDeals(updatedDeals);

    addAuditEntry({
      dealId,
      actor: approverRole,
      actorRole: 'Approver',
      eventType: 'REJECTED',
      summary: `Quotation rejected and returned to sales rep`,
      details: `Reason: ${reason || 'Discount level exceeds allowable commercial concessions.'}`,
      badgeVariant: 'danger',
    });
  };

  const submitCustomerNegotiation = (
    dealId: string,
    proposedDiscount: number,
    comments: string
  ) => {
    const targetDeal = deals.find((d) => d.id === dealId);
    if (!targetDeal) return;

    // Authoritative Customer Object-Level Tenant Check
    const session = AuthService.getCachedUser();
    if (!session || !RBAC.canSubmitNegotiation(session, targetDeal)) {
      console.warn('[SECURITY] Unauthorized customer negotiation attempt rejected.');
      return;
    }

    const updatedLines = targetDeal.lines.map((l) => {
      if (l.productId === 'prod-setup' || l.category === 'SERVICES') {
        return { ...l, discountPercent: proposedDiscount, requestedDiscountPercent: proposedDiscount };
      }
      return l;
    });

    const invalidation = detectMaterialInvalidation(targetDeal.approvedBaseline, updatedLines);
    
    const nextState: DealContext['state'] = invalidation.isInvalidated 
      ? 'INVALIDATED' 
      : targetDeal.state;

    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;
      return {
        ...d,
        lines: updatedLines,
        state: nextState,
        negotiationActive: true,
        version: d.version + 1,
        lastActivityDate: new Date().toISOString(),
        customerNotes: comments,
      };
    });

    persistDeals(updatedDeals);

    addAuditEntry({
      dealId,
      actor: targetDeal.customerName,
      actorRole: 'B2B Customer Portal',
      eventType: 'COUNTEROFFER_RECEIVED',
      summary: `Customer counter-offer submitted: ${proposedDiscount.toFixed(1)}% requested on Cloud Setup`,
      details: `Customer justification: "${comments}"`,
      badgeVariant: 'warning',
    });

    if (invalidation.isInvalidated) {
      addAuditEntry({
        dealId,
        actor: 'Deal Guardian',
        actorRole: 'Governance Engine',
        eventType: 'APPROVAL_INVALIDATED',
        summary: `Prior approval INVALIDATED due to material counteroffer drift!`,
        details: `Customer requested discount (${proposedDiscount.toFixed(1)}%) exceeds approved baseline (${targetDeal.approvedBaseline?.lines.find(l => l.productId === 'prod-setup')?.discountPercent || 15}%). Deal reset to PENDING_FINANCE.`,
        badgeVariant: 'danger',
      });
    }
  };

  const confirmOrderInOdoo = (dealId: string) => {
    const updatedDeals = deals.map((d) => {
      if (d.id !== dealId) return d;
      return {
        ...d,
        state: 'CONFIRMED' as DealContext['state'],
        odooOrderId: `SO-2026-${Math.floor(100 + Math.random() * 900)}`,
        lastActivityDate: new Date().toISOString(),
      };
    });

    persistDeals(updatedDeals);

    addAuditEntry({
      dealId,
      actor: 'Odoo ERP Integration Gateway',
      actorRole: 'Odoo Connector',
      eventType: 'ORDER_CONFIRMED',
      summary: `Deal committed as Sales Order in Odoo ERP (Order #SO-2026-084)`,
      details: `Delivery pickings generated across BOM-WH-01 and CCU-DP-02. Customer invoice queued.`,
      badgeVariant: 'success',
    });
  };

  /**
   * SALES MANAGER EXCLUSIVE ACTION: CUSTOMER CLASSIFICATION
   */
  const updateCustomerClassification = (
    customerId: string,
    newTier: CustomerTier,
    managerName: string
  ) => {
    // Authoritative Sales Manager exclusivity check
    const session = AuthService.getCachedUser();
    if (!session || !RBAC.canClassifyCustomer(session)) {
      console.warn('[SECURITY] Unauthorized customer classification attempt rejected.');
      return;
    }

    const maxDisc = newTier === 'GOLD' ? 15.0 : newTier === 'SILVER' ? 10.0 : 5.0;

    const updatedCustomers = customers.map((c) => {
      if (c.id === customerId) {
        return {
          ...c,
          tier: newTier,
          maxDiscount: maxDisc,
          classifiedBy: `${managerName} (Sales Manager)`,
          classifiedAt: new Date().toISOString(),
        };
      }
      return c;
    });
    persistCustomers(updatedCustomers);

    // Update tier in all deals for this customer
    const updatedDeals = deals.map((d) => {
      if (d.customerId === customerId) {
        return {
          ...d,
          customerTier: newTier,
          lastActivityDate: new Date().toISOString(),
        };
      }
      return d;
    });
    persistDeals(updatedDeals);

    const targetCustomer = customers.find((c) => c.id === customerId);
    addAuditEntry({
      dealId: 'deal-acme-1024',
      actor: managerName,
      actorRole: 'Sales Manager',
      eventType: 'TIER_CHANGED',
      summary: `Customer ${targetCustomer?.name || 'Customer'} reclassified to ${newTier} TIER`,
      details: `Maximum allowed discount capacity set to ${maxDisc.toFixed(1)}%. Enforced across all open quotations.`,
      badgeVariant: 'info',
    });
  };

  /**
   * ADMIN EXCLUSIVE ACTIONS: USER WORK ASSIGNMENT
   */
  const assignUserAccess = (userId: string) => {
    const session = AuthService.getCachedUser();
    if (!session || !RBAC.canManageUsers(session)) {
      console.warn('[SECURITY] Unauthorized user assignment attempt rejected.');
      return;
    }
    const updated = AuthService.assignUserWork(userId);
    setUsers([...updated]);

    const targetUser = updated.find((u) => u.id === userId);
    addAuditEntry({
      dealId: 'deal-acme-1024',
      actor: session.name,
      actorRole: 'Admin',
      eventType: 'WORK_ASSIGNED',
      summary: `Work access assigned to ${targetUser?.name || 'User'} (${targetUser?.role})`,
      details: `Application access status updated from PENDING to ASSIGNED. User can now access role dashboard.`,
      badgeVariant: 'success',
    });
  };

  const revokeUserAccess = (userId: string) => {
    const session = AuthService.getCachedUser();
    if (!session || !RBAC.canManageUsers(session)) {
      console.warn('[SECURITY] Unauthorized user access revocation attempt rejected.');
      return;
    }
    const updated = AuthService.revokeUserWork(userId);
    setUsers([...updated]);
  };

  const toggleUserActiveStatus = (userId: string) => {
    const session = AuthService.getCachedUser();
    if (!session || !RBAC.canManageUsers(session)) {
      console.warn('[SECURITY] Unauthorized user status toggle attempt rejected.');
      return;
    }
    const updated = AuthService.toggleUserStatus(userId);
    setUsers([...updated]);
  };

  const updateFulfillmentLine = (dealId: string, productId: string, fromMain: number, fromEast: number) => {
    console.log('Fulfillment override line', dealId, productId, fromMain, fromEast);
  };

  const acceptFulfillmentPlan = (dealId: string) => {
    addAuditEntry({
      dealId,
      actor: 'System Administrator',
      actorRole: 'Admin (Operations)',
      eventType: 'APPROVAL_REQUESTED',
      summary: `Multi-warehouse fulfillment allocation accepted by Admin`,
      details: `Shipment split confirmed (Main: 9 units, East: 1 unit). Courier charges locked in Odoo.`,
      badgeVariant: 'info',
    });
  };

  const resetDemoToGoldenPath = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUDIT_STORAGE_KEY);
    localStorage.removeItem(CUSTOMERS_STORAGE_KEY);
    setDeals(INITIAL_SEED_DEALS);
    setCustomers(INITIAL_CUSTOMERS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setUsers(AuthService.getAllUsers());
    setActiveDealId('deal-acme-1024');
    setDiscountErrorToast(null);
  };

  return (
    <DealFlowContext.Provider
      value={{
        deals: visibleDeals,
        activeDealId,
        setActiveDealId,
        activeDeal,
        customers,
        activeCustomer,
        evaluation,
        fulfillmentPlan,
        recommendations,
        auditLogs,
        allEvaluations,
        users,
        discountErrorToast,
        clearDiscountError,
        updateLineDiscount,
        updateLineQuantity,
        addLineFromRecommendation,
        addProductToDeal,
        removeLineItem,
        submitForApproval,
        approveDeal,
        rejectDeal,
        submitCustomerNegotiation,
        confirmOrderInOdoo,
        updateFulfillmentLine,
        acceptFulfillmentPlan,
        resetDemoToGoldenPath,
        updateCustomerClassification,
        assignUserAccess,
        revokeUserAccess,
        toggleUserActiveStatus,
      }}
    >
      {children}
    </DealFlowContext.Provider>
  );
};

export function useDealFlow() {
  const context = useContext(DealFlowContext);
  if (!context) {
    throw new Error('useDealFlow must be used within a DealFlowProvider');
  }
  return context;
}

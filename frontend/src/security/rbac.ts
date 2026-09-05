import { DealContext, UserAccount, UserRole } from '../types';

export class RBAC {
  public static hasRole(user: UserAccount | null, allowedRoles: UserRole[]): boolean {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }

  public static isAssigned(user: UserAccount | null): boolean {
    if (!user) return false;
    // Customer does not require internal work assignment
    if (user.role === 'CUSTOMER') return true;
    return user.assignmentStatus === 'ASSIGNED';
  }

  /**
   * Strict object-level security: can this user access this specific deal/quotation?
   */
  public static canAccessDeal(user: UserAccount | null, deal: DealContext): boolean {
    if (!user) return false;

    // Platform executives and admins have oversight access
    if (user.role === 'ADMIN' || user.role === 'SALES_MANAGER' || user.role === 'FINANCE_DIRECTOR') {
      return true;
    }

    // Sales Reps can only access deals assigned to their user ID or assigned deals list
    if (user.role === 'SALES_REP') {
      const isAssignedDirectly = deal.salesRepId === user.id;
      const isAssignedInList = user.assignedDeals ? user.assignedDeals.includes(deal.id) : false;
      return isAssignedDirectly || isAssignedInList;
    }

    // B2B Customer: STRICT TENANT ISOLATION - only access quotes matching their authenticated customer ID
    if (user.role === 'CUSTOMER') {
      return !!user.customerId && deal.customerId === user.customerId;
    }

    return false;
  }

  /**
   * Customer classification authority: STRICTLY EXCLUSIVE to SALES_MANAGER
   */
  public static canClassifyCustomer(user: UserAccount | null): boolean {
    if (!user) return false;
    return user.role === 'SALES_MANAGER';
  }

  /**
   * Fulfillment operations belong exclusively to ADMIN
   */
  public static canManageFulfillment(user: UserAccount | null): boolean {
    if (!user) return false;
    return user.role === 'ADMIN';
  }

  /**
   * User management and work assignment belong exclusively to ADMIN
   */
  public static canManageUsers(user: UserAccount | null): boolean {
    if (!user) return false;
    return user.role === 'ADMIN';
  }

  /**
   * L1 Commercial Approval (Discounts exceeding normal thresholds)
   */
  public static canApproveL1(user: UserAccount | null): boolean {
    if (!user) return false;
    return user.role === 'SALES_MANAGER' || user.role === 'ADMIN';
  }

  /**
   * L2 Executive Governance Approval (High risk scores, negative margins)
   */
  public static canApproveL2(user: UserAccount | null): boolean {
    if (!user) return false;
    return user.role === 'FINANCE_DIRECTOR' || user.role === 'ADMIN';
  }

  /**
   * Quotation building and line discount edits
   */
  public static canModifyQuote(user: UserAccount | null, deal: DealContext): boolean {
    if (!user) return false;
    if (user.role === 'CUSTOMER') return false; // Customers cannot edit enterprise line discounts!
    if (user.role === 'ADMIN') return true;
    if (user.role === 'SALES_REP') {
      return this.canAccessDeal(user, deal) && this.isAssigned(user);
    }
    return false;
  }

  /**
   * Customer negotiation authority
   */
  public static canSubmitNegotiation(user: UserAccount | null, deal: DealContext): boolean {
    if (!user) return false;
    return user.role === 'CUSTOMER' && !!user.customerId && deal.customerId === user.customerId;
  }
}

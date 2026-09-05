import React from 'react';
import { Badge } from '@/components/ui/badge';

interface StatusChipProps {
  status: string | null | undefined;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, className }) => {
  if (!status) return <Badge variant="outline">—</Badge>;

  const s = status.toUpperCase();

  switch (s) {
    // DealStatus
    case 'DRAFT':
      return <Badge variant="secondary" className={className}>Draft</Badge>;
    case 'SENT':
      return <Badge variant="info" className={className}>Sent to Customer</Badge>;
    case 'UNDER_NEGOTIATION':
      return <Badge variant="warning" className={className}>Under Negotiation</Badge>;
    case 'CONFIRMED':
      return <Badge variant="success" className={className}>Confirmed</Badge>;
    case 'IN_FULFILLMENT':
      return <Badge variant="info" className={className}>In Fulfillment</Badge>;
    case 'FULFILLED':
      return <Badge variant="success" className={className}>Fulfilled</Badge>;
    case 'INVOICED':
      return <Badge variant="info" className={className}>Invoiced</Badge>;
    case 'PAID':
      return <Badge variant="success" className={className}>Paid</Badge>;
    case 'CANCELLED':
      return <Badge variant="danger" className={className}>Cancelled</Badge>;
    case 'EXPIRED':
      return <Badge variant="outline" className={className}>Expired</Badge>;

    // ApprovalState
    case 'NOT_EVALUATED':
      return <Badge variant="outline" className={className}>Not Evaluated</Badge>;
    case 'EVALUATED_NO_APPROVAL':
      return <Badge variant="success" className={className}>Auto-Approved</Badge>;
    case 'PENDING_MANAGER':
      return <Badge variant="warning" className={className}>Pending: Sales Manager</Badge>;
    case 'PENDING_FINANCE':
      return <Badge variant="warning" className={className}>Pending: Finance</Badge>;
    case 'APPROVED':
      return <Badge variant="success" className={className}>Approved</Badge>;
    case 'REJECTED':
      return <Badge variant="danger" className={className}>Rejected</Badge>;
    case 'RETURNED':
      return <Badge variant="warning" className={className}>Returned</Badge>;
    case 'INVALIDATED':
      return <Badge variant="danger" className={className}>Invalidated</Badge>;

    // PortalStatus
    case 'UNDER_REVIEW':
      return <Badge variant="warning" className={className}>Under Review</Badge>;
    case 'CLOSED':
      return <Badge variant="outline" className={className}>Closed</Badge>;

    // General states
    case 'ACTIVE':
    case 'POSTED':
    case 'IN_PROGRESS':
    case 'OPEN':
      return <Badge variant="success" className={className}>{status}</Badge>;
    case 'PAUSED':
    case 'PENDING':
      return <Badge variant="warning" className={className}>{status}</Badge>;

    default:
      return <Badge variant="secondary" className={className}>{status}</Badge>;
  }
};

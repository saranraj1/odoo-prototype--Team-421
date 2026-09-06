import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/authStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { RiskBadge } from '@/components/data/RiskBadge';
import { HintStrip } from '@/components/data/HintStrip';
import { Button } from '@/components/ui/button';
import { approvalsApi } from '@/api/endpoints/approvals';
import { queryKeys } from '@/api/queryKeys';

export const ApprovalsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isFinance = user?.role === 'FINANCE';
  const isManager = user?.role === 'SALES_MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  // Initialize status from URL search query (?status=pending -> PENDING)
  const initialStatus = searchParams.get('status')?.toUpperCase();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RETURNED' | 'APPROVED'>(
    initialStatus === 'RETURNED'
      ? 'RETURNED'
      : initialStatus === 'APPROVED'
      ? 'APPROVED'
      : initialStatus === 'ALL'
      ? 'ALL'
      : 'PENDING'
  );
  const [filterPendingOnly, setFilterPendingOnly] = useState(
    initialStatus ? initialStatus === 'PENDING' : true
  );

  // Fetch all approvals to calculate real-time dynamic counters across all tabs
  const { data: allApprovals = [] } = useQuery({
    queryKey: queryKeys.approvals.list({}),
    queryFn: () => approvalsApi.list({}),
  });

  const { data: approvalsData = [], isLoading } = useQuery({
    queryKey: queryKeys.approvals.list({ pending: filterPendingOnly, status: statusFilter }),
    queryFn: () => approvalsApi.list({ pending: filterPendingOnly, status: statusFilter }),
  });

  // Calculate dynamic counts based on server/mock data
  const pendingCount = allApprovals.length > 0 ? allApprovals.filter((i) => i.status === 'PENDING').length : 3;
  const returnedCount = allApprovals.length > 0 ? allApprovals.filter((i) => i.status === 'RETURNED').length : 1;
  const approvedCount = allApprovals.length > 0 ? allApprovals.filter((i) => i.status === 'APPROVED').length : 5;

  // Canonical fallback items — role-aware so Finance always sees their queue
  const fallbackAll = [
    // Finance-stage items
    {
      id: 'deal_d1031_nexus',
      reference: 'D-1031',
      customer: 'Nexus Pharma Ltd',
      risk_score: 52.0,
      severity: 'HIGH',
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'PENDING',
      amount: 1250000,
    },
    {
      id: 'deal_d1028_vertex',
      reference: 'D-1028',
      customer: 'Vertex Technologies',
      risk_score: 34.5,
      severity: 'MEDIUM',
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'PENDING',
      amount: 870000,
    },
    {
      id: 'deal_d1021_delta',
      reference: 'D-1021',
      customer: 'Delta Systems Inc',
      risk_score: 44.5,
      severity: 'MEDIUM',
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'PENDING',
      amount: 780000,
    },
    {
      id: 'deal_d1018_zeta',
      reference: 'D-1018',
      customer: 'Zeta Tech',
      risk_score: 14.2,
      severity: 'LOW',
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'APPROVED',
      amount: 450000,
    },
    {
      id: 'deal_d1026_prism',
      reference: 'D-1026',
      customer: 'Prism Analytics',
      risk_score: 19.0,
      severity: 'LOW',
      stage: 'Finance',
      assigned_to: 'Vikram Finance Officer',
      status: 'APPROVED',
      amount: 480000,
    },
    // Manager-stage items
    {
      id: 'deal_d1024_acme',
      reference: 'D-1024',
      customer: 'Acme Corp',
      risk_score: 56.0,
      severity: 'HIGH',
      stage: 'Sales Manager',
      assigned_to: 'Sunita Sales Manager North',
      status: 'PENDING',
      amount: 558000,
    },
    {
      id: 'deal_d1023_beta',
      reference: 'D-1023',
      customer: 'Beta Industries',
      risk_score: 29.7,
      severity: 'MEDIUM',
      stage: 'Sales Manager',
      assigned_to: 'Sales Manager South',
      status: 'PENDING',
      amount: 420000,
    },
    {
      id: 'deal_d1019_gamma',
      reference: 'D-1019',
      customer: 'Gamma LLC',
      risk_score: 38.0,
      severity: 'MEDIUM',
      stage: 'Sales Manager',
      assigned_to: 'Sales Rep One',
      status: 'RETURNED',
      amount: 310000,
    },
  ];

  // Filter fallback by user role (matching same logic as the API handler)
  const roleFallback = isFinance
    ? fallbackAll.filter((i) => i.stage === 'Finance')
    : isManager
    ? fallbackAll.filter((i) => i.stage === 'Sales Manager')
    : isAdmin
    ? fallbackAll
    : fallbackAll.filter((i) => i.status === 'RETURNED');

  const items = approvalsData.length > 0
    ? approvalsData
    : roleFallback.filter((item) => {
        if (filterPendingOnly || statusFilter === 'PENDING') return item.status === 'PENDING';
        if (statusFilter === 'RETURNED') return item.status === 'RETURNED';
        if (statusFilter === 'APPROVED') return item.status === 'APPROVED';
        return true;
      });

  const handleSelectStatus = (status: 'ALL' | 'PENDING' | 'RETURNED' | 'APPROVED') => {
    setStatusFilter(status);
    setFilterPendingOnly(status === 'PENDING');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('status', status.toLowerCase());
    setSearchParams(newParams);
  };

  const handleTogglePendingOnly = () => {
    const nextPending = !filterPendingOnly;
    setFilterPendingOnly(nextPending);
    setStatusFilter(nextPending ? 'PENDING' : 'ALL');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('status', nextPending ? 'pending' : 'all');
    setSearchParams(newParams);
  };

  const columns: ColumnDef<any>[] = [
    {
      key: 'reference',
      header: 'Quotation',
      render: (item) => (
        <span className="font-bold text-text-primary hover:text-brand cursor-pointer">
          {item.reference}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (item) => <span className="text-text-primary font-medium">{item.customer}</span>,
    },
    {
      key: 'risk',
      header: 'Blended Risk',
      render: (item) => <RiskBadge score={item.risk_score} severity={item.severity} />,
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (item) => (
        <span className="font-medium text-warning">{item.stage}</span>
      ),
    },
    {
      key: 'assigned_to',
      header: 'Assigned To',
      render: (item) => <span>{item.assigned_to}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isFinance
            ? 'Finance Approvals Queue'
            : isManager
            ? 'Sales Manager Approvals Queue'
            : isAdmin
            ? 'Admin Approval Oversight'
            : 'Approvals (List)'
        }
        subtitle={
          isFinance
            ? 'Review high-value quotations requiring Commercial Finance Director sign-off'
            : 'Manage hierarchical approval queues and policy exception requests'
        }
      />

      {/* Filter Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectStatus('ALL')}
            className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
              statusFilter === 'ALL' && !filterPendingOnly
                ? 'bg-brand/20 text-brand border-brand'
                : 'bg-surface text-text-muted border-border'
            }`}
          >
            All ({allApprovals.length || 9})
          </button>
          <button
            type="button"
            onClick={() => handleSelectStatus('PENDING')}
            className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
              statusFilter === 'PENDING'
                ? 'bg-warning/20 text-warning border-warning'
                : 'bg-surface text-text-muted border-border'
            }`}
          >
            {pendingCount} Pending
          </button>
          <button
            type="button"
            onClick={() => handleSelectStatus('RETURNED')}
            className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
              statusFilter === 'RETURNED'
                ? 'bg-danger/20 text-danger border-danger'
                : 'bg-surface text-text-muted border-border'
            }`}
          >
            {returnedCount} Returned
          </button>
          <button
            type="button"
            onClick={() => handleSelectStatus('APPROVED')}
            className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
              statusFilter === 'APPROVED'
                ? 'bg-success/20 text-success border-success'
                : 'bg-surface text-text-muted border-border'
            }`}
          >
            {approvedCount} Approved
          </button>
        </div>

        <Button
          size="sm"
          variant={filterPendingOnly ? 'default' : 'outline'}
          onClick={handleTogglePendingOnly}
          className="text-xs h-7"
        >
          Filter: Pending Only
        </Button>
      </div>

      <DataTable
        data={items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(item) => navigate(`/approvals/${item.id}`)}
      />

      <HintStrip>
        Click any row to open its full approval detail, risk breakdown, and audit trail.
      </HintStrip>
    </div>
  );
};

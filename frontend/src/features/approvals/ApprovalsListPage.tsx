import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { RiskBadge } from '@/components/data/RiskBadge';
import { HintStrip } from '@/components/data/HintStrip';
import { Button } from '@/components/ui/button';
import { approvalsApi } from '@/api/endpoints/approvals';
import { queryKeys } from '@/api/queryKeys';

export const ApprovalsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterPendingOnly, setFilterPendingOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RETURNED' | 'APPROVED'>('PENDING');

  const { data: approvalsData = [], isLoading } = useQuery({
    queryKey: queryKeys.approvals.list({ pending: filterPendingOnly, status: statusFilter }),
    queryFn: () => approvalsApi.list({ pending: filterPendingOnly, status: statusFilter }),
  });

  // Mock list items if empty
  const items = approvalsData.length > 0 ? approvalsData : [
    {
      id: 'deal_d1024_acme',
      reference: 'D-1024',
      customer: 'Acme Corp',
      risk_score: 56.0,
      severity: 'HIGH',
      stage: 'Sales Manager',
      assigned_to: 'Sales Manager North',
      status: 'PENDING',
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
    },
  ];

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
        title="Approvals (List)"
        subtitle="Manage hierarchical approval queues and policy exception requests"
      />

      {/* Filter Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
              statusFilter === 'PENDING'
                ? 'bg-warning/20 text-warning border-warning'
                : 'bg-surface text-text-muted border-border'
            }`}
          >
            2 Pending
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('RETURNED')}
            className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
              statusFilter === 'RETURNED'
                ? 'bg-danger/20 text-danger border-danger'
                : 'bg-surface text-text-muted border-border'
            }`}
          >
            0 Returned
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
              statusFilter === 'APPROVED'
                ? 'bg-success/20 text-success border-success'
                : 'bg-surface text-text-muted border-border'
            }`}
          >
            5 Approved
          </button>
        </div>

        <Button
          size="sm"
          variant={filterPendingOnly ? 'default' : 'outline'}
          onClick={() => setFilterPendingOnly(!filterPendingOnly)}
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

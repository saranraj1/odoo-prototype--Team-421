import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { HintStrip } from '@/components/data/HintStrip';
import { billingApi } from '@/api/endpoints/billing';
import { queryKeys } from '@/api/queryKeys';

export const SubscriptionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED'>('ALL');

  const { data: allSubs = [] } = useQuery({
    queryKey: queryKeys.subscriptions.list({ status: 'ALL' }),
    queryFn: () => billingApi.listSubscriptions({ status: 'ALL' }),
  });

  const { data: subsData = [], isLoading } = useQuery({
    queryKey: queryKeys.subscriptions.list({ status: filterStatus }),
    queryFn: () => billingApi.listSubscriptions({ status: filterStatus }),
  });

  const fallbackSubs = [
    {
      id: 101,
      customer: 'Acme Corp',
      deal_id: 'deal_d1024_acme',
      plan: 'Monthly Gold Support',
      cycle: 'Monthly',
      next_bill: '2026-10-01',
      status: 'Active',
    },
    {
      id: 102,
      customer: 'Beta Industries',
      deal_id: 'deal_d1023_beta',
      plan: 'Enterprise SLA Tier 1',
      cycle: 'Quarterly',
      next_bill: '2026-11-01',
      status: 'Active',
    },
  ];

  const subsList = subsData.length > 0
    ? subsData
    : fallbackSubs.filter((s) => {
        if (filterStatus === 'ACTIVE') return s.status.toLowerCase() === 'active';
        if (filterStatus === 'PAUSED') return s.status.toLowerCase() === 'paused';
        return true;
      });

  const totalSubs = allSubs.length > 0 ? allSubs : fallbackSubs;
  const activeCount = totalSubs.filter((s) => s.status.toLowerCase() === 'active').length;
  const pausedCount = totalSubs.filter((s) => s.status.toLowerCase() === 'paused').length;
  const cancelledCount = totalSubs.filter((s) => s.status.toLowerCase() === 'cancelled').length;

  const columns: ColumnDef<any>[] = [
    { key: 'customer', header: 'Customer', render: (s) => <span className="font-semibold text-text-primary">{s.customer}</span> },
    { key: 'plan', header: 'Subscription Plan', render: (s) => <span className="text-info font-medium">{s.plan}</span> },
    { key: 'cycle', header: 'Billing Cycle' },
    { key: 'next_bill', header: 'Next Bill Date', className: 'tabular-nums' },
    {
      key: 'status',
      header: 'Status',
      render: (s) => {
        const isCancelled = s.status?.toLowerCase() === 'cancelled';
        const isPaused = s.status?.toLowerCase() === 'paused';
        return (
          <span
            className={`px-2.5 py-0.5 rounded-chip text-[10px] font-bold ${
              isCancelled
                ? 'bg-danger/20 text-danger border border-danger/40'
                : isPaused
                ? 'bg-warning/20 text-warning border border-warning/40'
                : 'bg-success/20 text-success border border-success/40'
            }`}
          >
            {s.status}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions (List)"
        subtitle="Manage recurring contract lifecycles, billing schedules, and proration terms"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterStatus('ALL')}
          className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
            filterStatus === 'ALL'
              ? 'bg-brand/20 text-brand border-brand'
              : 'bg-surface text-text-muted border-border'
          }`}
        >
          All ({totalSubs.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('ACTIVE')}
          className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
            filterStatus === 'ACTIVE'
              ? 'bg-success/20 text-success border-success'
              : 'bg-surface text-text-muted border-border'
          }`}
        >
          {activeCount} Active
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('PAUSED')}
          className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
            filterStatus === 'PAUSED'
              ? 'bg-warning/20 text-warning border-warning'
              : 'bg-surface text-text-muted border-border'
          }`}
        >
          {pausedCount} Paused
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('CANCELLED')}
          className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
            filterStatus === 'CANCELLED'
              ? 'bg-danger/20 text-danger border-danger'
              : 'bg-surface text-text-muted border-border'
          }`}
        >
          {cancelledCount} Cancelled
        </button>
      </div>

      <DataTable
        data={subsList}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(s) => navigate(`/billing/${s.deal_id || 'deal_d1024_acme'}`)}
      />

      <HintStrip>
        Click a subscription row to open its billing detail and proration history.
      </HintStrip>
    </div>
  );
};

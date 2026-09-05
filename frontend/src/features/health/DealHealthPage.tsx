import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/data/KpiCard';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { HealthBadge } from '@/components/data/HealthBadge';
import { Button } from '@/components/ui/button';
import { AlertActionModal } from './AlertActionModal';
import { healthApi } from '@/api/endpoints/health';
import { queryKeys } from '@/api/queryKeys';
import { formatRelativeDate } from '@/lib/format';
import { RefreshCw, Bell, ArrowUpRight } from 'lucide-react';
import type { DealAlertItem } from '@/api/types';

export const DealHealthPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedAlert, setSelectedAlert] = useState<DealAlertItem | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'NUDGE' | 'ESCALATE'>('NUDGE');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: queryKeys.alerts.list({ type: selectedTypeFilter }),
    queryFn: () => healthApi.getAlerts({ type: selectedTypeFilter }),
  });

  const recomputeMutation = useMutation({
    mutationFn: () => healthApi.recomputeAlerts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.list({}) });
    },
  });

  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const actionMutation = useMutation({
    mutationFn: ({ id, action, msg }: { id: string; action: 'NUDGE' | 'ESCALATE'; msg?: string }) =>
      healthApi.actOnAlert(id, { action, message: msg }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.list({}) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
      queryClient.invalidateQueries({ queryKey: queryKeys.controlTower.summary });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list({}) });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.list({}) });
      setActionModalOpen(false);

      const targetText = variables.action === 'NUDGE'
        ? 'Dispatched Nudge to Sales Representative (Inbox & Action Queue updated)'
        : 'Escalated to Sales Management & Finance Director (Approvals Queue updated)';
      setFeedbackBanner(targetText);
      setTimeout(() => setFeedbackBanner(null), 6000);
    },
  });

  const handleOpenAction = (alert: DealAlertItem, type: 'NUDGE' | 'ESCALATE') => {
    setSelectedAlert(alert);
    setActionType(type);
    setActionModalOpen(true);
  };

  const columns: ColumnDef<DealAlertItem>[] = [
    {
      key: 'deal_reference',
      header: 'Deal Reference',
      render: (item) => (
        <div>
          <span className="font-bold text-text-primary hover:text-brand cursor-pointer">
            {item.deal_reference}
          </span>
          <p className="text-[11px] text-text-muted">{item.customer_name}</p>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Identified Issue',
      render: (item) => (
        <div>
          <span className="font-medium text-text-primary">{item.title}</span>
          {item.last_action && (
            <p className="text-[10px] text-brand font-medium mt-0.5">
              ↳ {item.last_action}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Flagged Date',
      render: (item) => (
        <span className="text-text-muted">{formatRelativeDate(item.created_at)}</span>
      ),
    },
    {
      key: 'health_status',
      header: 'Health Status',
      render: (item) => (
        <div className="flex flex-col gap-1 items-start">
          <HealthBadge status={item.health_status} />
          {item.status === ('NUDGED' as any) && (
            <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950 px-1.5 py-0.5 rounded border border-sky-300 dark:border-sky-800">
              Nudge Dispatched
            </span>
          )}
          {item.status === ('ESCALATED' as any) && (
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-800">
              Escalated to Mgmt
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Remediation Actions',
      render: (item) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-brand border-brand/40"
            onClick={() => handleOpenAction(item, 'NUDGE')}
          >
            <Bell className="h-3 w-3 mr-1" />
            {item.status === ('NUDGED' as any) ? 'Nudge Again' : 'Nudge Rep'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            className="h-7 text-xs"
            onClick={() => handleOpenAction(item, 'ESCALATE')}
          >
            <ArrowUpRight className="h-3 w-3 mr-1" />
            {item.status === ('ESCALATED' as any) ? 'Escalated' : 'Escalate'}
          </Button>
        </div>
      ),
    },
  ];

  const stalledCount = alerts.filter((a) => a.type === 'STALLED_DEAL').length;
  const discountCount = alerts.filter((a) => a.type === 'DISCOUNT_ANOMALY').length;
  const slippageCount = alerts.filter((a) => a.type === 'DELIVERY_SLIPPAGE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deal Health & Anomaly Dashboard"
        subtitle="Real-time flags for stalled deals and unusual discount patterns"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => recomputeMutation.mutate()}
            disabled={recomputeMutation.isPending}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${recomputeMutation.isPending ? 'animate-spin' : ''}`} />
            Recompute Health Engine
          </Button>
        }
      />

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Stalled Deals"
          value={stalledCount}
          caption={`${stalledCount} quotation${stalledCount === 1 ? '' : 's'} idle 7+ days`}
          valueClassName="text-warning"
          className={selectedTypeFilter === 'STALLED_DEAL' ? 'ring-2 ring-brand' : ''}
          to="#"
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'STALLED_DEAL' ? '' : 'STALLED_DEAL')}
        />
        <KpiCard
          title="Discount Anomalies"
          value={discountCount}
          caption={`${discountCount} quotation${discountCount === 1 ? '' : 's'} exceeding rep baseline`}
          valueClassName="text-danger"
          className={selectedTypeFilter === 'DISCOUNT_ANOMALY' ? 'ring-2 ring-brand' : ''}
          to="#"
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'DISCOUNT_ANOMALY' ? '' : 'DISCOUNT_ANOMALY')}
        />
        <KpiCard
          title="Delivery Slippage"
          value={slippageCount}
          caption={`${slippageCount} promised date${slippageCount === 1 ? '' : 's'} at risk`}
          valueClassName={slippageCount > 0 ? 'text-danger' : 'text-success'}
          className={selectedTypeFilter === 'DELIVERY_SLIPPAGE' ? 'ring-2 ring-brand' : ''}
          to="#"
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'DELIVERY_SLIPPAGE' ? '' : 'DELIVERY_SLIPPAGE')}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
          Active Governance Flags
        </h3>
        <DataTable
          data={alerts}
          columns={columns}
          isLoading={isLoading}
          onRowClick={(item) => navigate(`/quotations/${item.deal_id}`)}
        />
      </div>

      {feedbackBanner && (
        <div className="p-3 rounded-card bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {selectedAlert && (
        <AlertActionModal
          open={actionModalOpen}
          onOpenChange={setActionModalOpen}
          actionType={actionType}
          alertTitle={selectedAlert.title}
          dealReference={selectedAlert.deal_reference}
          customerName={selectedAlert.customer_name}
          onConfirm={(msg) => actionMutation.mutate({ id: selectedAlert.id, action: actionType, msg })}
          isLoading={actionMutation.isPending}
        />
      )}
    </div>
  );
};

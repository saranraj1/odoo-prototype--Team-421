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

  const actionMutation = useMutation({
    mutationFn: ({ id, action, msg }: { id: string; action: 'NUDGE' | 'ESCALATE'; msg?: string }) =>
      healthApi.actOnAlert(id, { action, message: msg }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts.list({}) });
      setActionModalOpen(false);
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
      render: (item) => <span className="font-medium text-text-primary">{item.title}</span>,
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
      render: (item) => <HealthBadge status={item.health_status} />,
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
            Nudge Rep
          </Button>
          <Button
            size="sm"
            variant="danger"
            className="h-7 text-xs"
            onClick={() => handleOpenAction(item, 'ESCALATE')}
          >
            <ArrowUpRight className="h-3 w-3 mr-1" />
            Escalate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deal Health &amp; Anomaly Dashboard"
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
          value="1"
          caption="1 quotation idle 7+ days"
          valueClassName="text-warning"
          className={selectedTypeFilter === 'STALLED_DEAL' ? 'ring-2 ring-brand' : ''}
          to="#"
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'STALLED_DEAL' ? '' : 'STALLED_DEAL')}
        />
        <KpiCard
          title="Discount Anomalies"
          value="1"
          caption="1 quotation exceeding rep baseline"
          valueClassName="text-danger"
          className={selectedTypeFilter === 'DISCOUNT_ANOMALY' ? 'ring-2 ring-brand' : ''}
          to="#"
          onClick={() => setSelectedTypeFilter(selectedTypeFilter === 'DISCOUNT_ANOMALY' ? '' : 'DISCOUNT_ANOMALY')}
        />
        <KpiCard
          title="Delivery Slippage"
          value="0"
          caption="0 promised dates at risk"
          valueClassName="text-success"
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

      {selectedAlert && (
        <AlertActionModal
          open={actionModalOpen}
          onOpenChange={setActionModalOpen}
          actionType={actionType}
          alertTitle={selectedAlert.title}
          onConfirm={(msg) => actionMutation.mutate({ id: selectedAlert.id, action: actionType, msg })}
          isLoading={actionMutation.isPending}
        />
      )}
    </div>
  );
};

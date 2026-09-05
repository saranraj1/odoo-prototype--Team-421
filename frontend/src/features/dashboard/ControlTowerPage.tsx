import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/data/KpiCard';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { Button } from '@/components/ui/button';
import { healthApi } from '@/api/endpoints/health';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney, formatRelativeDate } from '@/lib/format';
import type { ActionQueueItem } from '@/api/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const ControlTowerPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: ctData, isLoading } = useQuery({
    queryKey: queryKeys.controlTower.summary,
    queryFn: () => healthApi.getControlTower(),
  });

  const nudgeMutation = useMutation({
    mutationFn: (id: string) => healthApi.actOnAlert(id, { action: 'NUDGE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.controlTower.summary });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: (id: string) => healthApi.actOnAlert(id, { action: 'ESCALATE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.controlTower.summary });
    },
  });

  const kpis = ctData?.kpis || {
    pipeline_value: 0,
    at_risk_count: 0,
    pending_approvals: 0,
    discount_exposure_amount: 0,
    stalled_count: 0,
    avg_approval_hours: 0,
    fulfillment_risk_count: 0,
  };

  const queueColumns: ColumnDef<ActionQueueItem>[] = [
    {
      key: 'severity',
      header: 'Severity',
      render: (item) => (
        <span
          className={`px-2 py-0.5 rounded-chip text-[10px] font-bold ${
            item.severity === 'HIGH'
              ? 'bg-danger/20 text-danger border border-danger/40'
              : 'bg-warning/20 text-warning border border-warning/40'
          }`}
        >
          {item.severity || 'HIGH'}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Action Title',
      render: (item) => (
        <div>
          <span className="font-semibold text-text-primary">{item.title}</span>
          <p className="text-[11px] text-text-muted">{item.customer} · {item.reference}</p>
        </div>
      ),
    },
    {
      key: 'raised_at',
      header: 'Age',
      render: (item) => (
        <span className="text-text-muted">{formatRelativeDate(item.raised_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (item) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {item.kind === 'APPROVAL' ? (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={() => navigate(item.deep_link)}
            >
              Review
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-brand border-brand/40"
                onClick={() => nudgeMutation.mutate(item.id)}
              >
                Nudge
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="h-7 text-xs"
                onClick={() => escalateMutation.mutate(item.id)}
              >
                Escalate
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const chartData = [
    { name: 'Draft', value: 350000 },
    { name: 'Pending', value: 558000 },
    { name: 'Approved', value: 420000 },
    { name: 'Negotiation', value: 240000 },
    { name: 'Confirmed', value: 282000 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Control Tower"
        subtitle="Executive governance cockpit, active SLA monitors, and real-time risk triage"
      />

      {/* Row of 7 KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard
          title="Pipeline Value"
          value={formatMoney(kpis.pipeline_value)}
          caption="Total governed pipeline"
        />
        <KpiCard
          title="At-Risk Deals"
          value={kpis.at_risk_count}
          caption="Deals needing action"
          valueClassName="text-danger"
          to="/deal-health"
        />
        <KpiCard
          title="Pending Approvals"
          value={kpis.pending_approvals}
          caption="Queue waiting decision"
          valueClassName="text-warning"
          to="/approvals"
        />
        <KpiCard
          title="Discount Exposure"
          value={formatMoney(kpis.discount_exposure_amount)}
          caption="Discount variance"
        />
        <KpiCard
          title="Stalled Deals"
          value={kpis.stalled_count}
          caption="Idle 7+ days"
          to="/deal-health"
        />
        <KpiCard
          title="Avg Approval"
          value={`${kpis.avg_approval_hours}h`}
          caption="SLA turnaround"
        />
        <KpiCard
          title="Fulfillment Risk"
          value={kpis.fulfillment_risk_count}
          caption="Split/late pickings"
          to="/fulfillment"
        />
      </div>

      {/* Action Queue */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
          Priority Action Queue
        </h3>
        <DataTable
          data={ctData?.action_queue || []}
          columns={queueColumns}
          isLoading={isLoading}
          onRowClick={(item) => navigate(item.deep_link)}
        />
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-card border border-border bg-surface p-5">
          <h4 className="text-xs font-bold text-text-secondary uppercase mb-4">
            Pipeline Value by Status
          </h4>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#6B7684" fontSize={11} />
                <YAxis stroke="#6B7684" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A2029', borderColor: '#2A313B' }}
                />
                <Bar dataKey="value" fill="#3B9EFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-5">
          <h4 className="text-xs font-bold text-text-secondary uppercase mb-4">
            Risk Distribution
          </h4>
          <div className="space-y-3 pt-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-success font-medium">Low Risk (0 - 20)</span>
                <span className="tabular-nums text-text-muted">65%</span>
              </div>
              <div className="h-2 rounded-full bg-elevated overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: '65%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-warning font-medium">Medium Risk (20 - 50)</span>
                <span className="tabular-nums text-text-muted">25%</span>
              </div>
              <div className="h-2 rounded-full bg-elevated overflow-hidden">
                <div className="h-full bg-warning rounded-full" style={{ width: '25%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-danger font-medium">High Risk (50 - 100)</span>
                <span className="tabular-nums text-text-muted">10%</span>
              </div>
              <div className="h-2 rounded-full bg-elevated overflow-hidden">
                <div className="h-full bg-danger rounded-full" style={{ width: '10%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

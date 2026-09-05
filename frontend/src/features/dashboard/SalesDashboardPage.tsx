import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/data/KpiCard';
import { Button } from '@/components/ui/button';
import { Plus, CheckSquare } from 'lucide-react';
import { dealsApi } from '@/api/endpoints/deals';
import { healthApi } from '@/api/endpoints/health';
import { notificationsApi } from '@/api/endpoints/notifications';
import { queryKeys } from '@/api/queryKeys';
import { formatRelativeDate } from '@/lib/format';

export const SalesDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: dealsData } = useQuery({
    queryKey: queryKeys.deals.list({ status: 'DRAFT,SENT,UNDER_NEGOTIATION' }),
    queryFn: () => dealsApi.list({ status: 'DRAFT,SENT,UNDER_NEGOTIATION' }),
  });

  const { data: ctData } = useQuery({
    queryKey: queryKeys.controlTower.summary,
    queryFn: () => healthApi.getControlTower(),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: () => notificationsApi.list(false),
  });

  const openDealsCount = dealsData?.total ?? 4;
  const pendingApprovals = ctData?.kpis.pending_approvals ?? 3;
  const atRiskCount = ctData?.kpis.at_risk_count ?? 2;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Dashboard / Home"
        subtitle="Central hub, links out to every module below"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/approvals')}
              className="gap-1.5"
            >
              <CheckSquare className="h-4 w-4" />
              <span>View Approvals</span>
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/quotations/new')}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>New Quotation</span>
            </Button>
          </div>
        }
      />

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Pending Approvals"
          value={pendingApprovals}
          caption={`${pendingApprovals} quotations waiting for decision`}
          to="/approvals?status=pending"
          valueClassName="text-warning"
        />
        <KpiCard
          title="Open Quotations"
          value={openDealsCount}
          caption={`${openDealsCount} active commercial quotes in pipeline`}
          to="/quotations"
        />
        <KpiCard
          title="At-Risk Deals"
          value={atRiskCount}
          caption={`${atRiskCount} quotations flagged by Deal Health`}
          to="/deal-health"
          valueClassName="text-danger"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="rounded-card border border-border bg-surface p-6">
        <h3 className="text-sm font-bold text-info uppercase tracking-wider mb-4">
          Recent Activity
        </h3>

        {notifications.length === 0 ? (
          <p className="text-xs text-text-muted">No recent governance updates.</p>
        ) : (
          <ul className="space-y-3">
            {notifications.slice(0, 8).map((n) => (
              <li
                key={n.id}
                onClick={() => n.entity_id && navigate(`/quotations/${n.entity_id}`)}
                className="flex items-start gap-3 p-2.5 rounded-input bg-elevated/40 hover:bg-elevated transition-colors cursor-pointer text-xs"
              >
                <div className="h-2 w-2 rounded-full bg-brand mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">{n.title}</span>
                    <span className="text-[10px] text-text-muted">
                      {formatRelativeDate(n.created_at)}
                    </span>
                  </div>
                  <p className="text-text-secondary mt-0.5">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

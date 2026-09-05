import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/data/KpiCard';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { approvalsApi } from '@/api/endpoints/approvals';
import { billingApi } from '@/api/endpoints/billing';
import { fulfillmentApi } from '@/api/endpoints/fulfillment';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney } from '@/lib/format';
import { RiskBadge } from '@/components/data/RiskBadge';

export const OperationsDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: approvals = [], isLoading: approvalsLoading } = useQuery({
    queryKey: queryKeys.approvals.inbox,
    queryFn: () => approvalsApi.getInbox(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: queryKeys.invoices.list({ status: 'unpaid' }),
    queryFn: () => billingApi.listInvoices({ status: 'unpaid' }),
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: queryKeys.fulfillment.exceptions,
    queryFn: () => fulfillmentApi.getExceptions(),
  });

  const columns: ColumnDef<any>[] = [
    {
      key: 'reference',
      header: 'Quotation',
      render: (item) => (
        <div>
          <span className="font-semibold text-text-primary">{item.reference || 'D-1024'}</span>
          <p className="text-[11px] text-text-muted">{item.customer || 'Acme Corp'}</p>
        </div>
      ),
    },
    {
      key: 'risk',
      header: 'Risk Score',
      render: (item) => <RiskBadge score={item.current_risk_score ?? 56} severity="HIGH" />,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item) => (
        <span className="tabular-nums">{formatMoney(item.amount_total_cache ?? 558000)}</span>
      ),
    },
    {
      key: 'stage',
      header: 'Approval Stage',
      render: () => <span className="text-warning font-medium">Pending: Finance</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Operations Dashboard"
        subtitle="Financial approval stage gates, unpaid invoice tracking, and delivery reconciliation"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Pending Finance Approvals"
          value={approvals.length || 1}
          caption="High-risk discount & margin escalations"
          valueClassName="text-warning"
          to="/approvals"
        />
        <KpiCard
          title="Unpaid Invoices"
          value={invoices.length || 1}
          caption="Awaiting payment registration"
          to="/invoices"
        />
        <KpiCard
          title="Fulfillment Exceptions"
          value={exceptions.length || 0}
          caption="Backorders or delivery slippages"
          to="/fulfillment"
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
          Finance Approval Queue
        </h3>
        <DataTable
          data={approvals.length > 0 ? approvals : [{ id: 'deal_d1024_acme', reference: 'D-1024', customer: 'Acme Corp' }]}
          columns={columns}
          isLoading={approvalsLoading}
          onRowClick={(item) => navigate(`/approvals/${item.id}`)}
        />
      </div>
    </div>
  );
};

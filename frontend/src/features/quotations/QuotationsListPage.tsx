import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { QuotationKanban } from './QuotationKanban';
import { RiskBadge } from '@/components/data/RiskBadge';
import { StatusChip } from '@/components/data/StatusChip';
import { HealthBadge } from '@/components/data/HealthBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { dealsApi } from '@/api/endpoints/deals';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney, formatRelativeDate } from '@/lib/format';

export const QuotationsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get('view') || 'kanban';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: listData, isLoading } = useQuery({
    queryKey: queryKeys.deals.list({ q: searchQuery, status: statusFilter }),
    queryFn: () => dealsApi.list({ q: searchQuery, status: statusFilter }),
  });

  const setView = (view: 'kanban' | 'table') => {
    const params = new URLSearchParams(searchParams);
    params.set('view', view);
    setSearchParams(params);
  };

  const columns: ColumnDef<any>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (deal) => (
        <div>
          <span className="font-bold text-text-primary">{deal.reference}</span>
          <p className="text-[11px] text-text-muted">{deal.odoo_order_name}</p>
        </div>
      ),
    },
    {
      key: 'partner',
      header: 'Customer',
      render: (deal) => (
        <span className="font-medium text-text-primary">
          {deal.partner_name_cache || 'Acme Corp'}
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (deal) => <span>{deal.owner?.name || 'Sales Rep One'}</span>,
    },
    {
      key: 'amount',
      header: 'Total Amount',
      render: (deal) => (
        <span className="font-semibold tabular-nums">
          {formatMoney(deal.amount_total_cache ?? 558000, deal.currency_code)}
        </span>
      ),
    },
    {
      key: 'risk',
      header: 'Blended Risk',
      render: (deal) => (
        <RiskBadge score={deal.current_risk_score} severity={deal.current_severity} />
      ),
    },
    {
      key: 'approval',
      header: 'Approval State',
      render: (deal) => <StatusChip status={deal.approval_state} />,
    },
    {
      key: 'health',
      header: 'Health',
      render: (deal) => <HealthBadge status={deal.health_status} />,
    },
    {
      key: 'updated',
      header: 'Last Activity',
      render: (deal) => (
        <span className="text-text-muted">{formatRelativeDate(deal.last_activity_at)}</span>
      ),
    },
  ];

  const deals = listData?.items || [];

  const getDealKanbanStatus = (d: any): string => {
    const s = d.status || d.deal?.status;
    const a = d.approval_state || d.deal?.approval_state;
    if (s === 'CONFIRMED' || s === 'IN_FULFILLMENT' || a === 'CONFIRMED') return 'CONFIRMED';
    if (s === 'UNDER_NEGOTIATION' || a === 'UNDER_NEGOTIATION') return 'UNDER_NEGOTIATION';
    if (s === 'APPROVED' || a === 'APPROVED') return 'APPROVED';
    if (s === 'DRAFT' || a === 'DRAFT' || a === 'NOT_EVALUATED') return 'DRAFT';
    if (s === 'PENDING_APPROVAL' || a?.startsWith('PENDING_')) return 'PENDING_APPROVAL';
    return s || 'DRAFT';
  };

  const kanbanColumns = [
    {
      status: 'DRAFT',
      items: deals.filter((d) => getDealKanbanStatus(d) === 'DRAFT'),
    },
    {
      status: 'PENDING_APPROVAL',
      items: deals.filter((d) => getDealKanbanStatus(d) === 'PENDING_APPROVAL'),
    },
    {
      status: 'APPROVED',
      items: deals.filter((d) => getDealKanbanStatus(d) === 'APPROVED'),
    },
    {
      status: 'UNDER_NEGOTIATION',
      items: deals.filter((d) => getDealKanbanStatus(d) === 'UNDER_NEGOTIATION'),
    },
    {
      status: 'CONFIRMED',
      items: deals.filter((d) => getDealKanbanStatus(d) === 'CONFIRMED'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        subtitle="Manage and govern commercial sales orders linked to Odoo transactional records"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-input border border-border bg-surface p-0.5">
              <Button
                size="sm"
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                className="h-7 px-2.5 text-xs"
                onClick={() => setView('kanban')}
                title="Kanban view"
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Kanban
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                className="h-7 px-2.5 text-xs"
                onClick={() => setView('table')}
                title="Table view"
              >
                <List className="h-3.5 w-3.5 mr-1" />
                Table
              </Button>
            </div>

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

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-surface p-3 rounded-card border border-border">
        <Input
          placeholder="Search by customer, reference (D-1024), or Odoo SO…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 max-w-sm text-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 w-44 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="UNDER_NEGOTIATION">Under Negotiation</option>
          <option value="CONFIRMED">Confirmed</option>
        </Select>
      </div>

      {viewMode === 'kanban' ? (
        <QuotationKanban columns={kanbanColumns} />
      ) : (
        <DataTable
          data={deals}
          columns={columns}
          isLoading={isLoading}
          onRowClick={(deal) => navigate(`/quotations/${deal.id}`)}
        />
      )}
    </div>
  );
};

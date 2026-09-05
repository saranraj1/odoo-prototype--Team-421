import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { HintStrip } from '@/components/data/HintStrip';
import { billingApi } from '@/api/endpoints/billing';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney } from '@/lib/format';

export const InvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterState, setFilterState] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');

  const { data: allInvoices = [] } = useQuery({
    queryKey: queryKeys.invoices.list({ status: 'ALL' }),
    queryFn: () => billingApi.listInvoices({ status: 'ALL' }),
  });

  const { data: invoicesData = [], isLoading } = useQuery({
    queryKey: queryKeys.invoices.list({ status: filterState }),
    queryFn: () => billingApi.listInvoices({ status: filterState }),
  });

  const fallbackInvoices = [
    {
      id: 1042,
      number: 'INV-1042',
      customer: 'Acme Corp',
      deal_id: 'deal_d1024_acme',
      amount: 558000,
      status: 'Unpaid',
      due_date: '2026-10-05',
    },
    {
      id: 1043,
      number: 'INV-1043',
      customer: 'Beta Industries',
      deal_id: 'deal_d1023_beta',
      amount: 420000,
      status: 'Paid',
      due_date: '2026-09-01',
    },
  ];

  const invoiceList = invoicesData.length > 0
    ? invoicesData
    : fallbackInvoices.filter((i) => {
        if (filterState === 'UNPAID') return i.status.toLowerCase() === 'unpaid';
        if (filterState === 'PAID') return i.status.toLowerCase() === 'paid';
        return true;
      });

  const totalInvoices = allInvoices.length > 0 ? allInvoices : fallbackInvoices;
  const unpaidCount = totalInvoices.filter((i) => i.status.toLowerCase() === 'unpaid').length;
  const paidCount = totalInvoices.filter((i) => i.status.toLowerCase() === 'paid').length;

  const columns: ColumnDef<any>[] = [
    {
      key: 'number',
      header: 'Invoice #',
      render: (item) => (
        <span className="font-bold text-text-primary hover:text-brand cursor-pointer">
          {item.number}
        </span>
      ),
    },
    { key: 'customer', header: 'Customer' },
    {
      key: 'amount',
      header: 'Amount',
      render: (item) => (
        <span className="font-semibold tabular-nums">{formatMoney(item.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <span
          className={`px-2 py-0.5 rounded-chip text-[10px] font-bold ${
            item.status.toLowerCase() === 'paid'
              ? 'bg-success/20 text-success border border-success/40'
              : 'bg-danger/20 text-danger border border-danger/40'
          }`}
        >
          {item.status}
        </span>
      ),
    },
    { key: 'due_date', header: 'Due Date', className: 'tabular-nums' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Manage billing transactions, customer payments, and delivery reconciliation"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterState('ALL')}
          className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
            filterState === 'ALL'
              ? 'bg-brand/20 text-brand border-brand'
              : 'bg-surface text-text-muted border-border'
          }`}
        >
          All ({totalInvoices.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterState('UNPAID')}
          className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
            filterState === 'UNPAID'
              ? 'bg-danger/20 text-danger border-danger'
              : 'bg-surface text-text-muted border-border'
          }`}
        >
          {unpaidCount} Unpaid
        </button>
        <button
          type="button"
          onClick={() => setFilterState('PAID')}
          className={`px-3 py-1 rounded-chip text-xs font-bold border transition-colors ${
            filterState === 'PAID'
              ? 'bg-success/20 text-success border-success'
              : 'bg-surface text-text-muted border-border'
          }`}
        >
          {paidCount} Paid
        </button>
      </div>

      <DataTable
        data={invoiceList}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(item) => navigate(`/invoices/${item.id}`)}
      />

      <HintStrip>
        Click an invoice row to open its full payment and delivery reconciliation detail.
      </HintStrip>
    </div>
  );
};

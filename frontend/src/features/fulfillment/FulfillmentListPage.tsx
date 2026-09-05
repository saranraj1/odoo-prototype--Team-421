import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { HintStrip } from '@/components/data/HintStrip';
import { productsApi } from '@/api/endpoints/products';
import { dealsApi } from '@/api/endpoints/deals';
import { queryKeys } from '@/api/queryKeys';

export const FulfillmentListPage: React.FC = () => {
  const navigate = useNavigate();

  const { isLoading: stockLoading } = useQuery({
    queryKey: queryKeys.warehouses.list(true),
    queryFn: () => productsApi.getWarehouses(true),
  });

  const { data: dealsData } = useQuery({
    queryKey: queryKeys.deals.list({ status: 'CONFIRMED,IN_FULFILLMENT' }),
    queryFn: () => dealsApi.list({ status: 'CONFIRMED,IN_FULFILLMENT' }),
  });

  const stockRows = [
    { warehouse: 'Main Warehouse (WH1)', product: 'Laptop Pro 14"', inStock: 10, reserved: 2, available: 8 },
    { warehouse: 'East Depot (WH2)', product: 'Laptop Pro 14"', inStock: 5, reserved: 3, available: 2 },
    { warehouse: 'Main Warehouse (WH1)', product: 'Universal Docking Station', inStock: 25, reserved: 5, available: 20 },
    { warehouse: 'Main Warehouse (WH1)', product: 'Setup Service', inStock: '—', reserved: '—', available: 'Unlimited (Service)' },
  ];

  const orderRows = dealsData?.items?.length ? dealsData.items : [
    {
      id: 'deal_d1024_acme',
      order: 'D-1024 (S00012)',
      customer: 'Acme Corp',
      status: 'Split Pending',
      warehouses: 'Main Warehouse (8) + East Depot (2)',
    },
  ];

  const stockColumns: ColumnDef<any>[] = [
    { key: 'warehouse', header: 'Warehouse' },
    { key: 'product', header: 'Product Description' },
    { key: 'inStock', header: 'In Stock', className: 'text-right tabular-nums pr-6' },
    { key: 'reserved', header: 'Reserved', className: 'text-right tabular-nums pr-6' },
    {
      key: 'available',
      header: 'Available',
      className: 'text-right tabular-nums pr-6 font-bold text-emerald-700',
    },
  ];

  const orderColumns: ColumnDef<any>[] = [
    {
      key: 'order',
      header: 'Order Reference',
      render: (item) => <span className="font-bold text-text-primary">{item.order || item.reference}</span>,
    },
    { key: 'customer', header: 'Customer', render: (item) => item.customer || item.partner_name_cache || 'Acme Corp' },
    {
      key: 'status',
      header: 'Fulfillment Status',
      render: (item) => (
        <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          {item.status || 'Split Pending'}
        </span>
      ),
    },
    { key: 'warehouses', header: 'Warehouse Allocations' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fulfillment and Stock (List)"
        subtitle="Multi-warehouse inventory visibility, allocation strategies, and order dispatch"
      />

      {/* Table 1: Live Stock */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
          Live Stock per Warehouse
        </h3>
        <DataTable data={stockRows} columns={stockColumns} isLoading={stockLoading} />
      </div>

      {/* Table 2: Orders Awaiting Fulfillment */}
      <div className="space-y-2 pt-4">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
          Orders Awaiting Fulfillment
        </h3>
        <DataTable
          data={orderRows}
          columns={orderColumns}
          onRowClick={(item) => navigate(`/fulfillment/${item.id}`)}
        />
      </div>

      <HintStrip>
        Click an order row to open its warehouse split detail.
      </HintStrip>
    </div>
  );
};

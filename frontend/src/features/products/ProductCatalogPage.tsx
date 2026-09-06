import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/data/KpiCard';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { HintStrip } from '@/components/data/HintStrip';
import { productsApi } from '@/api/endpoints/products';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney } from '@/lib/format';
import { MOCK_PRODUCTS } from '@/mocks/fixtures/products';

export const ProductCatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: productsData = [], isLoading } = useQuery({
    queryKey: queryKeys.products.list({ category: selectedCategory }),
    queryFn: () => productsApi.list({ category: selectedCategory === 'all' ? undefined : selectedCategory }),
  });

  const { data: categoriesData = [] } = useQuery({
    queryKey: queryKeys.products.categories,
    queryFn: () => productsApi.getCategories(),
  });

  const productList: any[] = Array.isArray(productsData) && productsData.length > 0
    ? productsData
    : (productsData as any)?.data || MOCK_PRODUCTS;

  const categories: any[] = Array.isArray(categoriesData) && categoriesData.length > 0
    ? categoriesData
    : (categoriesData as any)?.data || [
        { id: 1, name: 'Hardware' },
        { id: 2, name: 'Services' },
        { id: 3, name: 'Subscriptions' },
        { id: 4, name: 'Accessories' },
      ];

  const filteredProducts = selectedCategory === 'all'
    ? productList
    : productList.filter((p) => String(p.category_id) === selectedCategory || p.category_name?.toLowerCase() === selectedCategory.toLowerCase());

  const columns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Product Name',
      render: (p) => (
        <span className="font-bold text-text-primary hover:text-brand cursor-pointer">
          {p.name}
        </span>
      ),
    },
    { key: 'category_name', header: 'Category' },
    {
      key: 'price',
      header: 'Catalog Price',
      render: (p) => (
        <span className="tabular-nums font-semibold">{formatMoney(p.list_price)}</span>
      ),
    },
    { key: 'uom', header: 'Unit of Measure' },
    {
      key: 'tax',
      header: 'Tax Rate',
      render: (p) => <span className="tabular-nums">{p.tax}%</span>,
    },
    {
      key: 'type',
      header: 'Status',
      render: () => (
        <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-success/20 text-success border border-success/40">
          Active
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalog"
        subtitle="Odoo ERP master product catalog with live Deal Guardian discount policies"
      />

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total Products" value={String(productList.length)} caption="Active in Odoo catalog" />
        <KpiCard title="Pricelists" value="3 Tiers" caption="GOLD, SILVER, BRONZE policies" />
        <KpiCard title="Catalog SKUs" value={`${productList.filter((p) => p.type === 'STOCKABLE').length} Physical`} caption="Multi-warehouse enabled" />
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1 rounded-chip text-xs font-semibold transition-colors ${
            selectedCategory === 'all'
              ? 'bg-brand text-brand-ink font-bold'
              : 'bg-surface text-text-secondary hover:bg-elevated border border-border'
          }`}
        >
          All Categories
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategory(String(c.id))}
            className={`px-3 py-1 rounded-chip text-xs font-semibold transition-colors ${
              selectedCategory === String(c.id)
                ? 'bg-brand text-brand-ink font-bold'
                : 'bg-surface text-text-secondary hover:bg-elevated border border-border'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <DataTable
        data={filteredProducts}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(p) => navigate(`/products/${p.id}`)}
      />

      <HintStrip>
        Click a product row to open general info, variants and tier/currency price lists.
      </HintStrip>
    </div>
  );
};

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HintStrip } from '@/components/data/HintStrip';
import { productsApi } from '@/api/endpoints/products';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney } from '@/lib/format';
import { ODOO_URL } from '@/lib/constants';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { id = '101' } = useParams();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery({
    queryKey: queryKeys.products.detail(Number(id)),
    queryFn: () => productsApi.get(Number(id)),
  });

  if (isLoading || !product) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/products')}
          className="gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products Catalog
        </Button>
      </div>

      <PageHeader
        title={`Product Details: ${product.name}`}
        subtitle="Catalog specifications, multi-warehouse stock levels, and discount policy guardrails"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`${ODOO_URL}/web#model=product.template&id=${id}`, '_blank')}
            className="gap-1.5 text-xs"
          >
            <span>Edit in Odoo</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        }
      />

      {/* Panel 1: General Info in Two Columns */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-text-primary">General Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div>
                <span className="text-text-muted block">Product Name:</span>
                <p className="font-semibold text-text-primary">{product.name}</p>
              </div>
              <div>
                <span className="text-text-muted block">Category:</span>
                <p className="font-medium text-text-primary">{product.category_name || 'Hardware'}</p>
              </div>
              <div>
                <span className="text-text-muted block">Catalog List Price:</span>
                <p className="font-bold text-brand tabular-nums text-sm">{formatMoney(product.list_price)}</p>
              </div>
              <div>
                <span className="text-text-muted block">Unit of Measure:</span>
                <p className="text-text-primary">{product.uom || 'Units'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-text-muted block">Tax Rate:</span>
                <p className="font-medium text-text-primary">{product.tax || 18}%</p>
              </div>
              <div>
                <span className="text-text-muted block">Subscription Service:</span>
                <p className="font-medium text-text-primary">{product.is_recurring ? 'Yes (Recurring)' : 'No'}</p>
              </div>
              <div>
                <span className="text-text-muted block">Quantity On Hand:</span>
                <p className="font-bold text-success tabular-nums text-sm">13 units available</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel 2: Governance Guardrails */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-info uppercase tracking-wider">
            DealFlow Governance &amp; Ceilings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-text-secondary">
            Discount policy ceilings enforced by Deal Guardian for <strong>{product.category_name || 'Hardware'}</strong>:
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded bg-elevated/40 border border-border">
              <span className="text-[11px] font-semibold text-text-muted block">Gold Tier</span>
              <span className="text-base font-bold text-text-primary">15.0% Max</span>
            </div>
            <div className="p-3 rounded bg-elevated/40 border border-border">
              <span className="text-[11px] font-semibold text-text-muted block">Silver Tier</span>
              <span className="text-base font-bold text-text-primary">10.0% Max</span>
            </div>
            <div className="p-3 rounded bg-elevated/40 border border-border">
              <span className="text-[11px] font-semibold text-text-muted block">Bronze Tier</span>
              <span className="text-base font-bold text-text-primary">5.0% Max</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <HintStrip>
        Recurring products are invoiced at the beginning of each period by Odoo Subscriptions.
      </HintStrip>
    </div>
  );
};

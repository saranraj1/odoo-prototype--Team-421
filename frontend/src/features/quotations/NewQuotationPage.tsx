import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { productsApi } from '@/api/endpoints/products';
import { dealsApi } from '@/api/endpoints/deals';
import { formatMoney } from '@/lib/format';

interface DraftLine {
  product_id: number;
  qty: number;
  discount_pct: number;
}

export const NewQuotationPage: React.FC = () => {
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState<number>(1);
  const [lines, setLines] = useState<DraftLine[]>([
    { product_id: 101, qty: 10, discount_pct: 12 },
    { product_id: 201, qty: 1, discount_pct: 18 },
    { product_id: 301, qty: 1, discount_pct: 10 },
  ]);

  const { data: partners = [] } = useQuery({
    queryKey: ['partners', 'all'],
    queryFn: () => productsApi.getPartners(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => productsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => dealsApi.create(partnerId, lines),
    onSuccess: (data) => {
      const id = data?.id || data?.deal?.id || 'deal_d1024_acme';
      navigate(`/quotations/${id}`);
    },
  });

  const addLine = () => {
    if (products.length > 0) {
      setLines([...lines, { product_id: products[0].id, qty: 1, discount_pct: 0 }]);
    }
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const selectedPartner = partners.find((p) => p.id === Number(partnerId));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/quotations')}
          className="gap-1 text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotations
        </Button>
      </div>

      <PageHeader
        title="Create New Quotation"
        subtitle="Initiate a commercial sales quotation governed by the Deal Guardian"
      />

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-base font-semibold">1. Customer Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">
                Select Customer (Odoo Partner)
              </label>
              <Select
                value={partnerId}
                onChange={(e) => setPartnerId(Number(e.target.value))}
                className="h-9"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.tier_code ? `(${p.tier_code} Tier)` : ''}
                  </option>
                ))}
              </Select>
            </div>
            {selectedPartner?.tier_code && (
              <div className="pt-5">
                <span className="px-3 py-1 rounded-chip text-xs font-bold bg-info/20 text-info border border-info/40">
                  {selectedPartner.tier_code} Tier Policy
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">2. Order Lines</CardTitle>
          <Button size="sm" variant="outline" onClick={addLine} className="gap-1 h-7 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {lines.map((line, idx) => {
              const product = products.find((p) => p.id === line.product_id);
              const unitPrice = product?.list_price ?? 50000;
              const subtotal = line.qty * unitPrice * (1 - line.discount_pct / 100);

              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-input border border-border bg-elevated/40"
                >
                  <div className="flex-1">
                    <Select
                      value={line.product_id}
                      onChange={(e) => updateLine(idx, { product_id: Number(e.target.value) })}
                      className="h-8 text-xs"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatMoney(p.list_price)})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) => updateLine(idx, { qty: Math.max(1, Number(e.target.value)) })}
                      placeholder="Qty"
                      className="h-8 text-xs tabular-nums text-center"
                    />
                  </div>

                  <div className="w-24">
                    <div className="relative flex items-center">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={line.discount_pct}
                        onChange={(e) => updateLine(idx, { discount_pct: Number(e.target.value) })}
                        placeholder="Disc %"
                        className="h-8 text-xs tabular-nums pr-5 text-right"
                      />
                      <span className="absolute right-2 text-xs text-text-muted">%</span>
                    </div>
                  </div>

                  <div className="w-28 text-right font-semibold text-xs tabular-nums text-text-primary">
                    {formatMoney(subtotal)}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="p-1.5 text-text-muted hover:text-danger rounded-chip"
                    disabled={lines.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || lines.length === 0}
              className="font-bold gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating & Evaluating…
                </>
              ) : (
                'Create & Evaluate Quotation'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

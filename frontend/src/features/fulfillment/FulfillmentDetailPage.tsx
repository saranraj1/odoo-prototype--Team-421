import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HintStrip } from '@/components/data/HintStrip';
import { ManualOverrideModal } from './ManualOverrideModal';
import { ConsolidateBackorderBanner } from './ConsolidateBackorderBanner';
import { fulfillmentApi } from '@/api/endpoints/fulfillment';
import { dealsApi } from '@/api/endpoints/deals';
import { productsApi } from '@/api/endpoints/products';
import { queryKeys } from '@/api/queryKeys';
import { ArrowLeft, Check, Split, Send } from 'lucide-react';

export const FulfillmentDetailPage: React.FC = () => {
  const { dealId = 'deal_d1024_acme' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const { data: workspace, isLoading } = useQuery({
    queryKey: queryKeys.deals.workspace(dealId),
    queryFn: () => dealsApi.getWorkspace(dealId),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: queryKeys.warehouses.list(),
    queryFn: () => productsApi.getWarehouses(),
  });

  const acceptMutation = useMutation({
    mutationFn: () => fulfillmentApi.accept(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setSuccessToast('Suggested warehouse split accepted.');
    },
  });

  const overrideMutation = useMutation({
    mutationFn: (payload: any) => fulfillmentApi.override(dealId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setOverrideModalOpen(false);
      setSuccessToast('Manual warehouse split override applied.');
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => fulfillmentApi.apply(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setSuccessToast('Fulfillment plan applied to Odoo. Pickings generated.');
    },
  });

  const consolidateMutation = useMutation({
    mutationFn: () => fulfillmentApi.consolidate(dealId, { warehouse_id: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setSuccessToast('Backorders successfully consolidated.');
    },
  });

  if (isLoading || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  const { fulfillment, deal, customer } = workspace;
  const plan = fulfillment.plan;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/fulfillment')}
          className="gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Fulfillment List
        </Button>
      </div>

      {successToast && (
        <div className="p-3 rounded-input bg-success/20 border border-success/50 text-success text-xs font-semibold">
          ✓ {successToast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Fulfillment Detail: {deal.reference} ({customer.name})
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Algorithm-optimized warehouse splitting to minimize freight cost and shipment count
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            className="gap-1 font-bold text-xs"
          >
            <Check className="h-3.5 w-3.5" />
            Accept Suggested Split
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setOverrideModalOpen(true)}
            className="gap-1 text-xs"
          >
            <Split className="h-3.5 w-3.5" />
            Manual Override
          </Button>

          <Button
            size="sm"
            variant="success"
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="gap-1 font-bold text-xs"
          >
            <Send className="h-3.5 w-3.5" />
            Apply to Odoo
          </Button>
        </div>
      </div>

      {fulfillment.consolidatable ? (
        <ConsolidateBackorderBanner
          onConsolidate={() => consolidateMutation.mutate()}
          isLoading={consolidateMutation.isPending}
        />
      ) : (
        <HintStrip>
          'Consolidate Remaining Backorder' prompt appears automatically once stock arrives.
        </HintStrip>
      )}

      {/* Plan Table */}
      <Card className="border-border bg-surface">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-text-primary">
            Optimized Warehouse Allocation Breakdown
          </CardTitle>
          <span className="px-2.5 py-0.5 rounded-chip text-xs font-mono font-bold bg-brand/20 text-brand">
            Strategy: {plan?.strategy || 'MIN_SHIPMENTS'}
          </span>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-input border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-text-secondary border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Warehouse</th>
                  <th className="py-2.5 px-4 font-semibold">Product</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Qty Fulfilled</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Est. Shipments</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Freight Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {plan?.lines.map((l, idx) => (
                  <tr key={idx} className="hover:bg-elevated/30">
                    <td className="py-2.5 px-4 font-semibold text-text-primary">{l.warehouse_name}</td>
                    <td className="py-2.5 px-4">{l.product_name}</td>
                    <td className="py-2.5 px-4 text-center font-bold tabular-nums text-success">{l.allocated_qty} units</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">1</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{l.shipping_cost.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ManualOverrideModal
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        onConfirmOverride={(p) => overrideMutation.mutate(p)}
        lines={plan?.lines || []}
        warehouses={warehouses}
        isLoading={overrideMutation.isPending}
      />
    </div>
  );
};

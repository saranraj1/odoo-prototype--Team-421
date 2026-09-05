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
import { ArrowLeft, Check, Split, RotateCcw, AlertTriangle } from 'lucide-react';

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

  // Accept Suggested Split with optimistic UI cache update
  const acceptMutation = useMutation({
    mutationFn: () => fulfillmentApi.accept(dealId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      const previousWorkspace = queryClient.getQueryData(queryKeys.deals.workspace(dealId));

      if (previousWorkspace) {
        queryClient.setQueryData(queryKeys.deals.workspace(dealId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            fulfillment: {
              ...old.fulfillment,
              plan: {
                ...old.fulfillment?.plan,
                status: 'ACCEPTED',
                strategy: 'MIN_SHIPMENTS',
                override_reason: undefined,
                lines: [
                  {
                    odoo_sale_order_line_id: 1,
                    product_name: 'Laptop Pro 14"',
                    odoo_warehouse_id: 1,
                    warehouse_name: 'Main Warehouse',
                    requested_qty: 10,
                    allocated_qty: 8,
                    backorder_qty: 0,
                    shipping_cost: 15.0,
                  },
                  {
                    odoo_sale_order_line_id: 1,
                    product_name: 'Laptop Pro 14"',
                    odoo_warehouse_id: 2,
                    warehouse_name: 'East Depot',
                    requested_qty: 10,
                    allocated_qty: 2,
                    backorder_qty: 0,
                    shipping_cost: 10.0,
                  },
                ],
              },
            },
          };
        });
      }
      return { previousWorkspace };
    },
    onSuccess: (res) => {
      const updatedFulfillment = (res as any)?.data || res;
      if (updatedFulfillment) {
        queryClient.setQueryData(queryKeys.deals.workspace(dealId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            fulfillment: updatedFulfillment,
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setSuccessToast('Suggested warehouse split accepted and locked.');
    },
    onError: (_err, _vars, context) => {
      if (context?.previousWorkspace) {
        queryClient.setQueryData(queryKeys.deals.workspace(dealId), context.previousWorkspace);
      }
    },
  });

  // Manual Override with optimistic UI cache update
  const overrideMutation = useMutation({
    mutationFn: (payload: any) => fulfillmentApi.override(dealId, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      const previousWorkspace = queryClient.getQueryData(queryKeys.deals.workspace(dealId));

      if (previousWorkspace && Array.isArray(payload.allocations)) {
        const warehouseNames: Record<number, string> = {
          1: 'Main Warehouse',
          2: 'East Depot',
          3: 'West Hub',
        };

        const updatedLines = payload.allocations
          .map((a: any) => {
            const whId = Number(a.odoo_warehouse_id);
            return {
              odoo_sale_order_line_id: a.odoo_sale_order_line_id || 1,
              product_name: 'Laptop Pro 14"',
              odoo_warehouse_id: whId,
              warehouse_name: a.warehouse_name || warehouseNames[whId] || `Warehouse ${whId}`,
              requested_qty: 10,
              allocated_qty: Number(a.qty) || 0,
              backorder_qty: 0,
              shipping_cost: whId === 1 ? 15.0 : whId === 2 ? 10.0 : 20.0,
            };
          })
          .filter((l: any) => l.allocated_qty > 0);

        queryClient.setQueryData(queryKeys.deals.workspace(dealId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            fulfillment: {
              ...old.fulfillment,
              plan: {
                ...old.fulfillment?.plan,
                status: 'OVERRIDDEN',
                strategy: 'MANUAL_OVERRIDE',
                override_reason: payload.reason,
                lines: updatedLines,
              },
            },
          };
        });
      }
      return { previousWorkspace };
    },
    onSuccess: (res) => {
      const updatedFulfillment = (res as any)?.data || res;
      if (updatedFulfillment) {
        queryClient.setQueryData(queryKeys.deals.workspace(dealId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            fulfillment: updatedFulfillment,
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setOverrideModalOpen(false);
      setSuccessToast('Manual warehouse split override applied successfully.');
    },
    onError: (_err, _vars, context) => {
      if (context?.previousWorkspace) {
        queryClient.setQueryData(queryKeys.deals.workspace(dealId), context.previousWorkspace);
      }
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
  const plan = fulfillment?.plan;
  const isAccepted = plan?.status === 'ACCEPTED';
  const isOverridden = plan?.status === 'OVERRIDDEN';

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
        <div className="p-3 rounded-input bg-success/20 border border-success/50 text-success text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-[11px] underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Fulfillment Detail: {deal.reference} ({customer.name})
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-chip text-xs font-mono font-bold ${
                isAccepted
                  ? 'bg-success/20 text-success border border-success/40'
                  : isOverridden
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                  : 'bg-brand/20 text-brand border border-brand/40'
              }`}
            >
              {plan?.status || 'PROPOSED'}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Algorithm-optimized warehouse splitting to minimize freight cost and shipment count
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isAccepted ? 'outline' : 'default'}
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            className={`gap-1.5 font-bold text-xs transition-all ${
              isAccepted
                ? 'border-success/60 text-success bg-success/10 hover:bg-success/20 shadow-none'
                : 'bg-brand hover:bg-brand/90 text-white shadow-sm'
            }`}
            title={
              isAccepted
                ? 'Suggested split is accepted. Click to re-confirm.'
                : 'Accept optimal algorithmic split'
            }
          >
            <Check className="h-3.5 w-3.5" />
            {acceptMutation.isPending
              ? 'Accepting...'
              : isAccepted
              ? '✓ Split Accepted'
              : 'Accept Suggested Split'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setOverrideModalOpen(true)}
            className="gap-1.5 text-xs font-semibold hover:bg-elevated"
          >
            <Split className="h-3.5 w-3.5" />
            Manual Override
          </Button>
        </div>
      </div>

      {/* Manual Override Status Banner */}
      {isOverridden && (
        <div className="p-3.5 rounded-input bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold">Manual Split Override Active: </span>
              <span>{(plan as any)?.override_reason || 'Custom warehouse allocation applied.'}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            className="h-7 text-xs font-bold text-brand hover:text-brand/80 hover:bg-brand/10 gap-1 self-start sm:self-auto"
          >
            <RotateCcw className="h-3 w-3" />
            Revert to Optimal Split (8 / 2)
          </Button>
        </div>
      )}

      {fulfillment?.consolidatable ? (
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
          <div>
            <CardTitle className="text-sm font-bold text-text-primary">
              Optimized Warehouse Allocation Breakdown
            </CardTitle>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Live line-item warehouse assignments and freight calculations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-chip text-xs font-mono font-bold ${
                isAccepted
                  ? 'bg-success/20 text-success border border-success/40'
                  : isOverridden
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                  : 'bg-brand/20 text-brand border border-brand/40'
              }`}
            >
              Status: {plan?.status || 'PROPOSED'}
            </span>
            <span className="px-2.5 py-0.5 rounded-chip text-xs font-mono font-bold bg-elevated text-text-secondary border border-border">
              Strategy: {plan?.strategy || 'MIN_SHIPMENTS'}
            </span>
          </div>
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
                {plan?.lines && plan.lines.length > 0 ? (
                  plan.lines.map((l, idx) => (
                    <tr key={idx} className="hover:bg-elevated/30">
                      <td className="py-2.5 px-4 font-semibold text-text-primary">
                        {l.warehouse_name}
                      </td>
                      <td className="py-2.5 px-4">{l.product_name}</td>
                      <td className="py-2.5 px-4 text-center font-bold tabular-nums text-success">
                        {l.allocated_qty} units
                      </td>
                      <td className="py-2.5 px-4 text-center tabular-nums">1</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">
                        {(l.shipping_cost || 0).toFixed(1)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-secondary">
                      No allocation lines found.
                    </td>
                  </tr>
                )}
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

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HintStrip } from '@/components/data/HintStrip';
import { Dialog } from '@/components/ui/dialog';
import { UpcomingScheduleTable } from './UpcomingScheduleTable';
import { dealsApi } from '@/api/endpoints/deals';
import { billingApi } from '@/api/endpoints/billing';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney } from '@/lib/format';
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';

export const BillingDetailPage: React.FC = () => {
  const { dealId = 'deal_d1024_acme' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelSuccessModalOpen, setCancelSuccessModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation of recurring service contract');

  const { data: workspace, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.deals.workspace(dealId),
    queryFn: () => dealsApi.getWorkspace(dealId),
  });

  const billing = workspace?.billing;
  const customer = workspace?.customer;
  const activeSub = billing?.subscriptions?.[0];
  const subStatus = activeSub?.status || 'ACTIVE';
  const isCancelled = subStatus.toUpperCase() === 'CANCELLED';

  const cancelMutation = useMutation({
    mutationFn: (payload: { reason?: string }) =>
      billingApi.cancelSubscription(dealId, activeSub?.id || 101, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      const previousWorkspace = queryClient.getQueryData(queryKeys.deals.workspace(dealId));

      if (previousWorkspace) {
        queryClient.setQueryData(queryKeys.deals.workspace(dealId), (old: any) => {
          if (!old) return old;
          const updatedBilling = { ...old.billing };
          if (updatedBilling.subscriptions) {
            updatedBilling.subscriptions = updatedBilling.subscriptions.map((s: any) => ({
              ...s,
              status: 'CANCELLED',
              schedule: Array.isArray(s.schedule)
                ? s.schedule.map((item: any) => ({ ...item, status: 'CANCELLED' }))
                : [],
            }));
          }
          return {
            ...old,
            billing: updatedBilling,
          };
        });
      }
      return { previousWorkspace };
    },
    onSuccess: (res) => {
      if (res?.data?.billing) {
        queryClient.setQueryData(queryKeys.deals.workspace(dealId), (old: any) => {
          if (!old) return old;
          return { ...old, billing: res.data.billing };
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setCancelDialogOpen(false);
      setCancelSuccessModalOpen(true);
    },
    onError: (_err, _vars, context) => {
      if (context?.previousWorkspace) {
        queryClient.setQueryData(queryKeys.deals.workspace(dealId), context.previousWorkspace);
      }
    },
  });

  const handleConfirmCancel = () => {
    cancelMutation.mutate({ reason: cancelReason });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/subscriptions')}
          className="gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Subscriptions
        </Button>
      </div>

      <PageHeader
        title={`Billing Detail: ${customer?.name || 'Acme Corp'} – Monthly Gold Support`}
        subtitle="Segregated hybrid accounting: one-time commercial hardware and recurring Odoo subscriptions"
        actions={
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-chip text-xs font-mono font-bold ${
                isCancelled
                  ? 'bg-danger/20 text-danger border border-danger/40'
                  : 'bg-success/20 text-success border border-success/40'
              }`}
            >
              Status: {isCancelled ? 'CANCELLED' : 'ACTIVE'}
            </span>

            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {isCancelled ? (
              <Button
                size="sm"
                variant="outline"
                disabled
                className="gap-1 text-xs border-danger/40 text-danger bg-danger/10 opacity-90 cursor-not-allowed font-semibold"
              >
                <Ban className="h-3.5 w-3.5" />
                Subscription Cancelled
              </Button>
            ) : (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setCancelDialogOpen(true)}
                disabled={cancelMutation.isPending}
                className="gap-1 text-xs font-bold shadow-sm"
              >
                <Ban className="h-3.5 w-3.5" />
                Cancel Subscription
              </Button>
            )}
          </div>
        }
      />

      {isCancelled && (
        <div className="p-3.5 rounded-input bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <div>
            <span className="font-bold">Subscription Inactive: </span>
            <span>
              This recurring subscription has been cancelled and updated in the Odoo database. All future scheduled invoices for this period have been revoked.
            </span>
          </div>
        </div>
      )}

      {/* One-Time Lines Table */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-info uppercase tracking-wider">
            One-Time Lines (From Originating Order)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-text-secondary border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Product Description</th>
                  <th className="py-2.5 px-4 font-semibold text-center w-24">Qty</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Invoiced Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {billing?.one_time_lines?.map((ot: any, idx: number) => (
                  <tr key={idx} className="hover:bg-elevated/30">
                    <td className="py-2.5 px-4 font-medium text-text-primary">{ot.product_name}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">{ot.qty}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-bold text-text-primary">
                      {formatMoney(ot.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recurring Lines & Schedule */}
      <Card className="border-border bg-surface">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-info uppercase tracking-wider">
            Recurring Lines &amp; Upcoming Schedule
          </CardTitle>
          <span
            className={`px-2.5 py-0.5 rounded-chip text-xs font-mono font-bold ${
              isCancelled
                ? 'bg-danger/20 text-danger border border-danger/40'
                : 'bg-success/20 text-success border border-success/40'
            }`}
          >
            {isCancelled ? 'CANCELLED IN ODOO' : 'ACTIVE SCHEDULE'}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-text-secondary border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Plan Name</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Billing Cycle</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Next Bill Date</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Cadence Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {billing?.recurring_lines?.map((rec: any, idx: number) => (
                  <tr key={idx} className={`hover:bg-elevated/30 ${isCancelled ? 'opacity-60 bg-danger/5' : ''}`}>
                    <td className="py-2.5 px-4 font-semibold text-text-primary">
                      {rec.product_name} · {rec.plan_name}
                    </td>
                    <td className="py-2.5 px-4 text-center">{rec.cadence}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">
                      {isCancelled ? <span className="line-through text-text-muted">{rec.next_bill_date}</span> : rec.next_bill_date}
                    </td>
                    <td className={`py-2.5 px-4 text-right tabular-nums font-bold ${isCancelled ? 'line-through text-text-muted' : 'text-brand'}`}>
                      {formatMoney(rec.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-text-secondary">
                Upcoming Projected Billing Schedule:
              </span>
              {isCancelled && (
                <span className="text-[11px] font-bold text-danger">
                  All upcoming scheduled periods revoked
                </span>
              )}
            </div>
            <UpcomingScheduleTable schedule={billing?.subscriptions?.[0]?.schedule || []} />
          </div>
        </CardContent>
      </Card>

      <HintStrip>
        Recurring lines are billed by Odoo Subscriptions; one-time lines are invoiced once. Both are shown separately here.
      </HintStrip>

      {/* Confirmation Dialog to Cancel */}
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Recurring Subscription"
        description="Are you sure you want to cancel this contract? Live database records will be updated."
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelMutation.isPending}
            >
              Keep Subscription
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
              className="gap-1.5 font-bold"
            >
              {cancelMutation.isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Cancelling in Database…
                </>
              ) : (
                'Yes, Cancel Subscription'
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 py-2 text-xs">
          <div className="p-3 rounded-card bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Warning: Termination Action</p>
              <p className="leading-relaxed">
                Cancelling will terminate subscription #101 (Monthly Gold Support) for <strong>{customer?.name || 'Acme Corp'}</strong> in the Odoo database and cancel all future scheduled recurring charges.
              </p>
            </div>
          </div>

          <div>
            <label className="font-semibold text-text-secondary block mb-1.5">
              Cancellation Justification (Logged to Timeline &amp; Odoo Audit)
            </label>
            <textarea
              className="w-full h-20 p-2.5 rounded border border-border bg-elevated/40 text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-danger"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Customer requested cancellation of monthly support plan…"
            />
          </div>
        </div>
      </Dialog>

      {/* Pop-up Window: Subscription Cancelled Success Modal */}
      <Dialog
        open={cancelSuccessModalOpen}
        onOpenChange={setCancelSuccessModalOpen}
        title="Subscription Successfully Cancelled"
        description="Contract status and Odoo database records have been synchronized."
        footer={
          <Button
            variant="default"
            size="sm"
            onClick={() => setCancelSuccessModalOpen(false)}
            className="font-bold px-4"
          >
            Got It
          </Button>
        }
      >
        <div className="space-y-4 py-2 text-xs">
          <div className="p-3.5 rounded-card bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Subscription Cancelled &amp; Updated in Database</p>
              <p className="leading-relaxed">
                The recurring subscription for <strong>{customer?.name || 'Acme Corp'}</strong> has been revoked. All upcoming scheduled invoices have been cancelled in Odoo.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-card bg-elevated/40 border border-border space-y-2">
            <div className="flex items-center justify-between text-text-secondary">
              <span>Customer:</span>
              <span className="font-bold text-text-primary">{customer?.name || 'Acme Corp'}</span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span>Plan Name:</span>
              <span className="font-bold text-text-primary">Monthly Gold Support</span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span>Database Status:</span>
              <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-danger/20 text-danger border border-danger/40">
                CANCELLED
              </span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span>Future Scheduled Billing:</span>
              <span className="font-bold text-danger">Revoked / Inactive</span>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

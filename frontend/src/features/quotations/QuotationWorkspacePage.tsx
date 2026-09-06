import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/authStore';
import { dealsApi } from '@/api/endpoints/deals';
import { negotiationApi } from '@/api/endpoints/negotiation';
import { recommendationsApi } from '@/api/endpoints/recommendations';
import { queryKeys } from '@/api/queryKeys';
import { LinesTable } from './components/LinesTable';
import { RecommendationCards } from './components/RecommendationCards';
import { TotalsSummary } from './components/TotalsSummary';
import { CancelDealDialog } from './components/CancelDealDialog';
import { GuardianPanel } from '@/features/guardian/GuardianPanel';
import { NextBestActionBar } from '@/components/data/NextBestActionBar';
import { StatusChip } from '@/components/data/StatusChip';
import { Timeline } from '@/components/data/Timeline';
import { Button } from '@/components/ui/button';
import { Check, Send, CheckCircle2, XCircle, ArrowLeft, ArrowRight, RefreshCw, MessageSquare, Truck, CreditCard, History, Building2, PackagePlus, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { formatMoney, formatAbsoluteDate } from '@/lib/format';
import { ACME_HISTORICAL_ORDERS, ACME_CUSTOMER_PROFILE } from '@/features/portal/data/customerHistory';
import type { NextBestAction } from '@/api/types';

export const QuotationWorkspacePage: React.FC = () => {
  const { id = 'deal_d1024_acme' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [highlightedLineId, setHighlightedLineId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'negotiation' | 'fulfillment' | 'billing' | 'timeline'>('negotiation');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  const { data: workspace, isLoading } = useQuery({
    queryKey: queryKeys.deals.workspace(id),
    queryFn: () => dealsApi.getWorkspace(id),
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  // Mutations
  const updateLineMutation = useMutation({
    mutationFn: ({ lineId, patch }: { lineId: number; patch: any }) =>
      dealsApi.patchLine(id, lineId, patch),
    onMutate: () => setIsSaved(false),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
      setIsSaved(true);
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (lineId: number) => dealsApi.deleteLine(id, lineId),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
    },
  });

  const addRecMutation = useMutation({
    mutationFn: (recId: string) => recommendationsApi.add(id, recId),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
    },
  });

  const dismissRecMutation = useMutation({
    mutationFn: (recId: string) => recommendationsApi.dismiss(id, recId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(id) });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => dealsApi.submit(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['controlTower'] });
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: () => dealsApi.evaluate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(id) });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => dealsApi.send(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => dealsApi.confirm(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['controlTower'] });
      queryClient.invalidateQueries({ queryKey: ['control-tower'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => dealsApi.cancel(id, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['controlTower'] });
      setCancelOpen(false);
    },
  });

  const updateOrderDiscountMutation = useMutation({
    mutationFn: (val: number) => dealsApi.patch(id, { order_discount_pct: val }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setIsSaved(true);
    },
  });

  const acceptProposalMutation = useMutation({
    mutationFn: (req: any) =>
      dealsApi.acceptProposalAndAddItem(id, {
        request_id: req.id,
        product_id: req.product_id,
        qty: req.requested_qty || 1,
        discount_pct: 0,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  // Accept/Decline counter-offer negotiation (works for both Sales Rep and Sales Manager)
  const respondNegotiationMutation = useMutation({
    mutationFn: ({ reqId, decision, req }: { reqId: string; decision: 'ACCEPT' | 'REJECT'; req?: any }) =>
      negotiationApi.respond(id, reqId, {
        decision,
        actor_name: user?.name || 'Sales Rep',
        actor_role: user?.role || 'SALES_REP',
        type: req?.type,
        target_amount: req?.target_amount,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.deals.workspace(id), updated);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  if (isLoading || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  const { deal, customer, quote, recommendations, timeline, next_best_action, approval } = workspace;
  const isPreApproved = approval.state === 'APPROVED' || deal.approval_state === 'APPROVED';
  const canSend = deal.status !== 'CONFIRMED';
  const canConfirm = (deal.approval_state === 'APPROVED' || approval.state === 'APPROVED') && deal.status !== 'CONFIRMED';

  const handleExecuteNextAction = (action: NextBestAction) => {
    if (action.cta_endpoint) {
      navigate(action.cta_endpoint);
    } else if (action.type === 'CONFIRM_ORDER') {
      confirmMutation.mutate();
    } else if (action.type === 'SEND_TO_CUSTOMER') {
      sendMutation.mutate();
    } else if (action.type === 'MANAGER_APPROVAL_REQUIRED' || action.type === 'FINANCE_APPROVAL_REQUIRED') {
      navigate(`/approvals/${deal.id}`);
    } else if (action.type === 'REDUCE_DISCOUNT' || action.type === 'REAPPROVAL_REQUIRED') {
      submitMutation.mutate();
    } else {
      if (['PENDING_MANAGER', 'PENDING_FINANCE'].includes(deal.approval_state)) {
        navigate(`/approvals/${deal.id}`);
      } else {
        submitMutation.mutate();
      }
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top navigation back */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/quotations')}
          className="gap-1.5 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotations
        </Button>

        <div className="flex items-center gap-2">
          {isSaved ? (
            <span className="flex items-center gap-1 text-[11px] text-success font-medium">
              <Check className="h-3.5 w-3.5" />
              All changes saved
            </span>
          ) : (
            <span className="text-[11px] text-text-muted animate-pulse">
              Saving changes…
            </span>
          )}
        </div>
      </div>

      {/* Main Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Quotation Detail: {deal.reference} ({customer.name})
            </h1>
            <span className="text-xs text-text-muted font-mono bg-elevated px-2 py-0.5 rounded border border-border">
              {deal.odoo_order_name}
            </span>
            <StatusChip status={deal.status} />
            <StatusChip status={deal.approval_state} />
            {customer.tier_code && (
              <span className="px-2.5 py-0.5 rounded-chip text-xs font-bold bg-info/20 text-info border border-info/40">
                {customer.tier_code} Tier
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-text-secondary mt-1.5 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span>Customer:</span>
              <strong className="text-text-primary">{customer.name}</strong>
              <button
                type="button"
                onClick={() => setCustomerHistoryOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors ml-1 cursor-pointer"
                title="Click to view full purchase history over time"
              >
                <History className="h-3 w-3" />
                <span>4 Past Orders · ₹24.8L Spend</span>
              </button>
            </span>
            <span>Price List: <strong className="text-text-primary">Default B2B ({deal.currency_code})</strong></span>
            <span>Payment Terms: <strong className="text-text-primary">{customer.payment_term_days} Days</strong></span>
          </div>
        </div>

        {/* Action Buttons Top-Right */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => evaluateMutation.mutate()}
            disabled={evaluateMutation.isPending}
            className="gap-1.5 text-xs"
            title="Re-run Deal Guardian assessment"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${evaluateMutation.isPending ? 'animate-spin' : ''}`} />
            Re-evaluate
          </Button>

          {['NONE', 'NOT_EVALUATED', 'DRAFT', 'RETURNED', 'INVALIDATED'].includes(deal.approval_state) ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="gap-1.5 text-xs font-bold shadow-sm"
              title="Submit quotation into approval review queue"
            >
              <span>Submit for Approval</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : deal.approval_state === 'PENDING_MANAGER' || deal.approval_state === 'PENDING_FINANCE' ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => navigate(`/approvals/${deal.id}`)}
              className="gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              title="Click to open approval decision workflow"
            >
              <span>Proceed to Approval Decision</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : deal.status === 'SENT' ? (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="gap-1.5 text-xs font-semibold text-success"
            >
              <Check className="h-3.5 w-3.5" />
              Sent to Customer
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !canSend}
              className="gap-1.5 text-xs font-semibold"
            >
              <Send className="h-3.5 w-3.5" />
              Send to Customer
            </Button>
          )}

          <Button
            size="sm"
            variant="success"
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || !canConfirm}
            className="gap-1.5 text-xs font-bold shadow-sm"
            title="Confirm order and synchronize with Odoo ERP"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirm Order
          </Button>

          <Button
            size="sm"
            variant="danger"
            onClick={() => setCancelOpen(true)}
            className="gap-1 text-xs"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Customer Item Proposal Banner */}
      {workspace.negotiation?.open_requests && workspace.negotiation.open_requests.length > 0 && (
        <div className="rounded-card border-2 border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">!</span>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Customer Proposal Received
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900 border border-amber-300">
              {user?.role === 'SALES_MANAGER' ? 'Awaiting Sales Manager Review' : 'Awaiting Sales Rep Review & Warehouse Stock Add'}
            </span>
          </div>
          {workspace.negotiation.open_requests.map((req: any) => (
            <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-md bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-xs">
              <div>
                <p className="font-bold text-text-primary">
                  {req.type === 'ADD_ITEM_REQUEST'
                    ? `Requested Adding: ${req.requested_qty || 1}x ${req.product_name || req.line_name}`
                    : req.type === 'COUNTER_AMOUNT'
                    ? `Customer Counter Amount: ₹${(req.requested_value || 0).toLocaleString('en-IN')}`
                    : `Proposed Discount Concession: ${req.requested_value}%`}
                </p>
                <p className="text-text-secondary mt-0.5">{req.message}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {req.type === 'ADD_ITEM_REQUEST' ? (
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => acceptProposalMutation.mutate(req)}
                    disabled={acceptProposalMutation.isPending}
                    className="gap-1.5 text-xs font-bold shadow-xs"
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                    Accept & Add from Warehouse Stock
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => respondNegotiationMutation.mutate({ reqId: req.id, decision: 'ACCEPT', req })}
                      disabled={respondNegotiationMutation.isPending}
                      className="gap-1.5 text-xs font-bold shadow-xs"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Accept Customer Negotiation
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => respondNegotiationMutation.mutate({ reqId: req.id, decision: 'REJECT' })}
                      disabled={respondNegotiationMutation.isPending}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      Decline
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Confirmed Verification Banner */}
      {(deal.status === 'PENDING_REP_VERIFICATION' || (deal.customer_confirmed_pending && deal.status !== 'CONFIRMED')) && (
        <div className="rounded-card border-2 border-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Customer Accepted & Confirmed Quotation
            </h3>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
              Buyer confirmed order on customer portal. Sales Rep must verify line items and submit into internal multi-tier governance review (Sales Manager → Finance Team → Executive Admin).
            </p>
          </div>
          <Button
            size="sm"
            variant="default"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"
          >
            <span>Verify & Submit to Manager</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* 2-Column Split: 65% Quote, 35% Guardian Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (65%) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Order Lines Table */}
          <LinesTable
            lines={quote.lines}
            currency={deal.currency_code}
            orderDiscountPct={deal.order_discount_pct}
            onUpdateLine={(lineId, patch) => updateLineMutation.mutate({ lineId, patch })}
            onDeleteLine={(lineId) => deleteLineMutation.mutate(lineId)}
            onUpdateOrderDiscount={(val) => updateOrderDiscountMutation.mutate(val)}
            highlightedLineId={highlightedLineId}
          />

          {/* Upsell and Cross-Sell Suggestions */}
          <RecommendationCards
            recommendations={recommendations}
            onAdd={(recId) => addRecMutation.mutate(recId)}
            onDismiss={(recId) => dismissRecMutation.mutate(recId)}
            currency={deal.currency_code}
          />

          {/* Totals Summary */}
          <TotalsSummary totals={quote.totals} currency={deal.currency_code} />

          {/* Sub-Tabs Section */}
          <div className="rounded-card border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('negotiation')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === 'negotiation'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-text-muted hover:text-text-primary hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                  }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Customer Negotiation
                {workspace.negotiation.open_requests.length > 0 && (
                  <span className="rounded-chip bg-warning/20 text-warning px-1.5 py-0.2 text-[10px] font-bold">
                    {workspace.negotiation.open_requests.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('fulfillment')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === 'fulfillment'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-text-muted hover:text-text-primary hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                  }`}
              >
                <Truck className="h-3.5 w-3.5" />
                Fulfillment &amp; Warehouse
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('billing')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === 'billing'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-text-muted hover:text-text-primary hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                  }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Billing &amp; Subscriptions
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === 'timeline'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-text-muted hover:text-text-primary hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                  }`}
              >
                <History className="h-3.5 w-3.5" />
                Audit Timeline
              </button>
            </div>

            {/* Tab Contents */}
            <div className="pt-2 text-xs">
              {activeTab === 'negotiation' && (
                <div className="space-y-4">
                  {workspace.negotiation.open_requests.length === 0 ? (
                    <p className="text-text-muted">No open customer counter-offers or requests.</p>
                  ) : (
                    <div className="space-y-2">
                      <span className="font-semibold text-text-primary block">Open Customer Requests:</span>
                      {workspace.negotiation.open_requests.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3 rounded-input border border-warning/40 bg-warning/10"
                        >
                          <div>
                            <span className="font-bold text-text-primary">{r.type}: {r.line_name}</span>
                            <p className="text-text-secondary mt-0.5">{r.message} (Value: {r.requested_value}%)</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="success"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => respondNegotiationMutation.mutate({ reqId: r.id, decision: 'ACCEPT', req: r })}
                              disabled={respondNegotiationMutation.isPending}
                            >
                              <ThumbsUp className="h-3 w-3" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => respondNegotiationMutation.mutate({ reqId: r.id, decision: 'REJECT' })}
                              disabled={respondNegotiationMutation.isPending}
                            >
                              <ThumbsDown className="h-3 w-3" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-border">
                    <span className="font-semibold text-text-secondary block mb-2">Internal Notes &amp; Comments:</span>
                    <div className="space-y-2">
                      {workspace.negotiation.comments.map((c) => (
                        <div key={c.id} className="p-2.5 rounded bg-elevated/40 border border-border">
                          <div className="flex justify-between font-semibold text-[11px] text-text-primary">
                            <span>{c.author_name} ({c.author_role})</span>
                            <span className="text-text-muted">{c.is_internal ? 'INTERNAL NOTE' : 'PORTAL COMMENT'}</span>
                          </div>
                          <p className="mt-1 text-text-secondary">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'fulfillment' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">Warehouse Split Strategy: {workspace.fulfillment.plan?.strategy || 'MIN_SHIPMENTS'}</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/fulfillment/${deal.id}`)}>
                      Open Fulfillment Workspace
                    </Button>
                  </div>
                  {workspace.fulfillment.plan?.lines && (
                    <div className="divide-y divide-border border border-border rounded-input overflow-hidden">
                      {workspace.fulfillment.plan.lines.map((fl, idx) => (
                        <div key={idx} className="p-2.5 flex justify-between bg-elevated/30">
                          <span>{fl.product_name} ➔ <strong>{fl.warehouse_name}</strong></span>
                          <span className="tabular-nums font-semibold">{fl.allocated_qty} / {fl.requested_qty} units</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">Segregated Billing Breakdown</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/billing/${deal.id}`)}>
                      Open Billing Workspace
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded border border-border bg-elevated/20">
                      <span className="font-bold text-text-primary block mb-1">One-Time Lines:</span>
                      {workspace.billing.one_time_lines.map((ot: any, i: number) => (
                        <div key={i} className="text-[11px] text-text-secondary">{ot.product_name} (×{ot.qty})</div>
                      ))}
                    </div>
                    <div className="p-3 rounded border border-border bg-elevated/20">
                      <span className="font-bold text-text-primary block mb-1">Recurring Subscriptions:</span>
                      {workspace.billing.recurring_lines.map((rec: any, i: number) => (
                        <div key={i} className="text-[11px] text-text-secondary">{rec.product_name} · {rec.plan_name}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && <Timeline events={timeline} />}
            </div>
          </div>
        </div>

        {/* Right Column (35%): Deal Guardian Panel */}
        <div className="lg:col-span-4">
          <GuardianPanel
            workspace={workspace}
            onHoverFactor={(lineId) => setHighlightedLineId(lineId)}
          />
        </div>
      </div>

      {/* Persistent Next Best Action Bar */}
      <NextBestActionBar
        action={next_best_action}
        onExecute={handleExecuteNextAction}
      />

      {/* Cancel Confirmation Dialog */}
      <CancelDealDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirmCancel={(reason) => cancelMutation.mutate(reason)}
        isLoading={cancelMutation.isPending}
      />

      {/* Customer Historical Orders Dialog */}
      <Dialog
        open={customerHistoryOpen}
        onOpenChange={setCustomerHistoryOpen}
        title={`Customer Order History: ${customer.name}`}
        description={`Commercial relationship summary: ${ACME_CUSTOMER_PROFILE.relationshipAge} · Lifetime Spend: ${formatMoney(ACME_CUSTOMER_PROFILE.lifetimeSpend, deal.currency_code, 0)}`}
        footer={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCustomerHistoryOpen(false)}
          >
            Close History
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-border">
            <div>
              <span className="text-[10px] text-text-muted block uppercase">Customer Tier</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{customer.tier_code || 'GOLD'} Tier</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block uppercase">Total Purchases</span>
              <span className="font-bold text-text-primary">4 Orders</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block uppercase">Avg Transaction</span>
              <span className="font-bold text-text-primary">{formatMoney(ACME_CUSTOMER_PROFILE.avgOrderValue, deal.currency_code, 0)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Chronological Order History
            </h4>
            <div className="divide-y divide-border/60 rounded-card border border-border overflow-hidden">
              {ACME_HISTORICAL_ORDERS.map((ord) => (
                <div key={ord.id} className="p-3 hover:bg-elevated/30 transition-colors flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-text-primary">{ord.orderNumber}</span>
                      <span className="text-[10px] font-mono bg-elevated px-1.5 py-0.2 rounded border border-border text-text-muted">{ord.odooReference}</span>
                      <span className="text-[11px] text-text-muted">· {formatAbsoluteDate(ord.date)} ({ord.quarter})</span>
                    </div>
                    <p className="text-[11px] text-text-secondary">
                      {ord.items.map(i => `${i.quantity}x ${i.name}`).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="font-bold tabular-nums text-text-primary block">{formatMoney(ord.total, ord.currency)}</span>
                    <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${ord.status === 'DELIVERED' ? 'text-emerald-700 bg-emerald-50' : ord.status === 'COMPLETED' ? 'text-slate-700 bg-slate-100' : 'text-amber-700 bg-amber-50'
                      }`}>
                      {ord.statusLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

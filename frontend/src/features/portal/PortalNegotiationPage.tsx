import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePortalDeal } from './hooks/usePortalDeal';
import { PortalLinesTable } from './components/PortalLinesTable';
import { CounterOfferForm } from './components/CounterOfferForm';
import { ConfirmDealModal } from './components/ConfirmDealModal';
import { StatusChip } from '@/components/data/StatusChip';
import { HintStrip } from '@/components/data/HintStrip';
import { Button } from '@/components/ui/button';
import { portalApi } from '@/api/endpoints/portal';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney } from '@/lib/format';
import { CheckCircle2 } from 'lucide-react';

export const PortalNegotiationPage: React.FC = () => {
  const { id = 'deal_d1024_acme' } = useParams();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: deal, isLoading } = usePortalDeal(id);

  const counterMutation = useMutation({
    mutationFn: (payload: any) => portalApi.submitNegotiation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.deal(id) });
      setFeedback('Your counter-proposal has been submitted to the sales representative.');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (confirmWithOpenRequests: boolean) =>
      portalApi.confirmDeal(id, {
        accept_terms: true,
        confirm_with_open_requests: confirmWithOpenRequests,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.deal(id) });
      setConfirmModalOpen(false);
      setFeedback(res?.message || 'Quotation confirmation received.');
    },
  });

  if (isLoading || !deal) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  const hasOpenRequests = deal.my_requests && deal.my_requests.length > 0;

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3 rounded-input bg-info/20 border border-info/50 text-info text-xs font-semibold">
          ✓ {feedback}
        </div>
      )}

      {/* Wireframe 11 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Customer Portal Negotiation Screen
            </h1>
            <span className="font-mono text-xs bg-elevated px-2 py-0.5 rounded border border-border text-text-muted">
              {deal.number}
            </span>
            <StatusChip status={deal.portal_status} />
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Review and negotiate your quote directly, no email needed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={() => setConfirmModalOpen(true)}
            className="gap-1.5 font-bold"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirm Quotation
          </Button>
        </div>
      </div>

      {deal.portal_status === 'UNDER_REVIEW' && (
        <div className="rounded-input border border-warning/40 bg-warning/15 p-3 text-xs text-warning">
          <strong>Under Review:</strong> Your confirmation is currently awaiting internal management approval before final issuance.
        </div>
      )}

      {/* Whitelisted Lines Table */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
          Proposed Order Lines
        </h3>
        <PortalLinesTable lines={deal.lines} currency={deal.currency_code} />
      </div>

      {/* Order Totals */}
      <div className="flex justify-end">
        <div className="w-full max-w-xs rounded-card border border-border bg-surface p-4 space-y-2 text-xs">
          <div className="flex justify-between text-text-secondary">
            <span>Subtotal:</span>
            <span className="tabular-nums">{formatMoney(deal.totals.subtotal, deal.currency_code)}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Taxes:</span>
            <span className="tabular-nums">{formatMoney(deal.totals.tax, deal.currency_code)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between font-bold text-sm text-text-primary">
            <span>Total Payable:</span>
            <span className="text-brand tabular-nums">{formatMoney(deal.totals.total, deal.currency_code)}</span>
          </div>
        </div>
      </div>

      {/* Active Requests Table */}
      {hasOpenRequests && (
        <div className="rounded-card border border-border bg-surface p-4 space-y-3">
          <h4 className="text-xs font-bold text-warning uppercase tracking-wider">
            Your Active Negotiation Proposals
          </h4>
          <div className="divide-y divide-border/60">
            {deal.my_requests.map((r: any) => (
              <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-text-primary">{r.line_name || 'Entire Order'}: </span>
                  <span className="text-text-secondary">{r.message}</span>
                </div>
                <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-warning/20 text-warning">
                  Pending Review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counter Offer Form */}
      <CounterOfferForm
        lines={deal.lines}
        onSubmitRequest={(p) => counterMutation.mutate(p)}
        isLoading={counterMutation.isPending}
      />

      <HintStrip>
        If final terms exceed thresholds, the quote automatically re-enters approval.
      </HintStrip>

      {/* Confirm Deal Modal */}
      <ConfirmDealModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        onConfirm={(withdraw) => confirmMutation.mutate(withdraw)}
        hasOpenRequests={hasOpenRequests}
        isLoading={confirmMutation.isPending}
      />
    </div>
  );
};

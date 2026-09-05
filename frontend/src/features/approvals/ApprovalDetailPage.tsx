import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RiskBadge } from '@/components/data/RiskBadge';
import { Stepper } from '@/components/data/Stepper';
import { HintStrip } from '@/components/data/HintStrip';
import { DecisionModal } from './DecisionModal';
import { dealsApi } from '@/api/endpoints/deals';
import { approvalsApi } from '@/api/endpoints/approvals';
import { queryKeys } from '@/api/queryKeys';
import { formatPct, formatAbsoluteDate } from '@/lib/format';
import { useAuthStore } from '@/features/auth/authStore';
import { ArrowLeft, CheckCircle, RotateCcw, XCircle, ArrowUpRight } from 'lucide-react';

export const ApprovalDetailPage: React.FC = () => {
  const { dealId = 'deal_d1024_acme' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE'>('APPROVE');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const { data: workspace, isLoading } = useQuery({
    queryKey: queryKeys.deals.workspace(dealId),
    queryFn: () => dealsApi.getWorkspace(dealId),
  });

  const approveMutation = useMutation({
    mutationFn: (reason?: string) => approvalsApi.approve(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setToastError(null);
      setDecisionModalOpen(false);
      setToastMessage('Quotation approved and unlocked in Odoo.');
    },
    onError: (err: any) => {
      setToastError(err?.message || 'Approval failed. Please try again.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => approvalsApi.reject(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setToastError(null);
      setDecisionModalOpen(false);
      setToastMessage('Quotation rejected.');
    },
    onError: (err: any) => {
      setToastError(err?.message || 'Rejection failed. Please try again.');
    },
  });

  const returnMutation = useMutation({
    mutationFn: (reason: string) => approvalsApi.returnForRevision(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setToastError(null);
      setDecisionModalOpen(false);
      setToastMessage('Quotation returned to sales representative for revision.');
    },
    onError: (err: any) => {
      setToastError(err?.message || 'Return failed. Please try again.');
    },
  });

  const escalateMutation = useMutation({
    mutationFn: (reason?: string) => approvalsApi.escalate(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setToastError(null);
      setDecisionModalOpen(false);
      setToastMessage('Quotation escalated to higher executive authority.');
    },
    onError: (err: any) => {
      setToastError(err?.message || 'Escalation failed. Please try again.');
    },
  });

  if (isLoading || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  const { deal, customer, quote, risk, approval, timeline } = workspace;

  const rejectionEvent = timeline.find((e) => e.event_type === 'REJECTED');
  const returnEvent = timeline.find((e) => e.event_type === 'RETURNED');
  const isRejectedByFinance = rejectionEvent?.actor_role === 'FINANCE';
  const isReturnedByFinance = returnEvent?.actor_role === 'FINANCE';

  const isApproved = approval.state === 'APPROVED';
  const isRejected = approval.state === 'REJECTED';
  const isReturned = approval.state === 'RETURNED';
  const isPendingFinance = approval.state === 'PENDING_FINANCE';
  const isPendingManager = approval.state === 'PENDING_MANAGER';

  // Strict role-stage permission enforcement:
  // - Sales Manager can ONLY approve Stage 1 (PENDING_MANAGER).
  // - Finance can ONLY approve Stage 2 (PENDING_FINANCE).
  // - System Admin has executive override for either stage.
  // - Resolved/Confirmed deals cannot be decided further.
  const canUserActOnCurrentStage = () => {
    if (isApproved || isRejected || isReturned || deal.status === 'CONFIRMED' || deal.status === 'CANCELLED') {
      return false;
    }
    if (user?.role === 'ADMIN') return true;
    if (isPendingManager) {
      return user?.role === 'SALES_MANAGER';
    }
    if (isPendingFinance) {
      return user?.role === 'FINANCE' || user?.role === 'FINANCE_DIRECTOR';
    }
    return false;
  };

  const handleOpenDecision = (type: 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE') => {
    setToastError(null);
    setToastMessage(null);
    setDecisionType(type);
    setDecisionModalOpen(true);
  };

  const handleConfirmDecision = (reason?: string) => {
    switch (decisionType) {
      case 'APPROVE':
        approveMutation.mutate(reason);
        break;
      case 'REJECT':
        rejectMutation.mutate(reason || '');
        break;
      case 'RETURN':
        returnMutation.mutate(reason || '');
        break;
      case 'ESCALATE':
        escalateMutation.mutate(reason);
        break;
    }
  };

  // Compute stepper status with dedicated 'rejected' and 'returned' symbols
  const managerStepStatus = isApproved || isPendingFinance || isRejectedByFinance || isReturnedByFinance
    ? ('done' as const)
    : isRejected
    ? ('rejected' as const)
    : isReturned
    ? ('returned' as const)
    : isPendingManager
    ? ('current' as const)
    : ('pending' as const);

  const financeStepStatus = isApproved
    ? ('done' as const)
    : isRejected && isRejectedByFinance
    ? ('rejected' as const)
    : isReturned && isReturnedByFinance
    ? ('returned' as const)
    : isPendingFinance
    ? ('current' as const)
    : ('pending' as const);

  const stepperSteps = [
    { label: 'Submitted', status: 'done' as const },
    { label: 'Sales Manager', status: managerStepStatus },
    { label: 'Finance', status: financeStepStatus },
    { label: 'Confirmed', status: deal.status === 'CONFIRMED' ? ('done' as const) : ('pending' as const) },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/approvals')}
          className="gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Approvals List
        </Button>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-input bg-success/20 border border-success/50 text-success text-xs font-semibold flex items-center justify-between">
          <span>✓ {toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-success hover:opacity-80 text-sm font-bold">×</button>
        </div>
      )}

      {toastError && (
        <div className="p-3 rounded-input bg-danger/20 border border-danger/50 text-danger text-xs font-semibold flex items-center justify-between">
          <span>✕ {toastError}</span>
          <button onClick={() => setToastError(null)} className="text-danger hover:opacity-80 text-sm font-bold">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Approval Detail: {deal.reference} ({customer.name})
            </h1>
            {isRejected && (
              <span className="px-2.5 py-0.5 rounded-chip text-xs font-bold bg-red-100 text-red-700 border border-red-300 inline-flex items-center gap-1 shadow-xs">
                <XCircle className="h-3.5 w-3.5 text-red-600" />
                REJECTED
              </span>
            )}
            {isReturned && (
              <span className="px-2.5 py-0.5 rounded-chip text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1 shadow-xs">
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                RETURNED
              </span>
            )}
            {isApproved && (
              <span className="px-2.5 py-0.5 rounded-chip text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shadow-xs">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-700" />
                APPROVED
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-chip text-xs font-bold bg-danger/20 text-danger border border-danger/40">
              Blended Risk: {risk.severity}
            </span>
            <span className="px-2.5 py-0.5 rounded-chip text-xs font-bold bg-info/20 text-info border border-info/40">
              Customer Tier: {customer.tier_code}
            </span>
            <RiskBadge score={risk.score} severity={risk.severity} />
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Order Total: <strong>{deal.amount_total ?? quote.totals.total} {deal.currency_code}</strong> · Stage: <strong className={isRejected ? 'text-danger' : isApproved ? 'text-success' : 'text-text-primary'}>{approval.state}</strong>
          </p>
        </div>

        {/* Action Buttons - Rendered strictly when active user is authorized for current approval stage */}
        {canUserActOnCurrentStage() && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleOpenDecision('APPROVE')}
              className="gap-1.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenDecision('RETURN')}
              className="gap-1.5 font-medium text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
              Return for Revision
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenDecision('REJECT')}
              className="gap-1.5 font-medium text-xs border-red-200 text-red-700 hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenDecision('ESCALATE')}
              className="gap-1.5 text-xs text-slate-600 hover:text-slate-900 border-slate-200"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Escalate
            </Button>
          </div>
        )}
      </div>

      {/* Role State & Guidance Banners */}
      {isRejected && (
        <div className="p-4 rounded-card bg-red-50 border border-red-200 flex items-start gap-3 text-red-900 shadow-xs">
          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-900">Quotation Rejected by Governance</h4>
            <p className="text-xs text-red-700 mt-0.5">
              This quotation has been rejected. Transactions are locked in Odoo and terms cannot be sent to customer.
            </p>
            {rejectionEvent?.reason && (
              <p className="text-xs mt-1.5 font-medium text-slate-800 bg-white/80 px-2.5 py-1 rounded border border-red-200">
                Rejection Reason: {rejectionEvent.reason}
              </p>
            )}
          </div>
        </div>
      )}

      {isReturned && (
        <div className="p-4 rounded-card bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 shadow-xs">
          <RotateCcw className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">Quotation Returned for Revision</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Returned to sales representative for price and margin restructuring.
            </p>
            {returnEvent?.reason && (
              <p className="text-xs mt-1.5 font-medium text-slate-800 bg-white/80 px-2.5 py-1 rounded border border-amber-200">
                Revision Note: {returnEvent.reason}
              </p>
            )}
          </div>
        </div>
      )}

      {isPendingFinance && user?.role === 'SALES_MANAGER' && (
        <div className="p-3.5 rounded-card bg-slate-50 border border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center font-bold text-xs">✓</span>
            <div>
              <p className="text-xs font-bold text-slate-800">Stage 1 Approved by Sales Manager</p>
              <p className="text-[11px] text-slate-500">Currently awaiting Stage 2 sign-off from the Finance Department. Only Finance can approve this stage.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Pending Finance Sign-off
          </span>
        </div>
      )}

      {isPendingManager && (user?.role === 'FINANCE' || user?.role === 'FINANCE_DIRECTOR') && (
        <div className="p-3.5 rounded-card bg-slate-50 border border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 rounded-full bg-amber-100 text-amber-700 items-center justify-center font-bold text-xs">⏳</span>
            <div>
              <p className="text-xs font-bold text-slate-800">Stage 1 Pending: Awaiting Sales Manager</p>
              <p className="text-[11px] text-slate-500">Finance approval will unlock after the Sales Manager conducts stage 1 review.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
            Awaiting Manager
          </span>
        </div>
      )}

      {/* Stepper */}
      <Card className="border-border bg-surface p-4">
        <Stepper steps={stepperSteps} />
      </Card>

      {/* Section: Why This Quote Was Flagged */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Why This Quote Was Flagged
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-input border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 text-[11px] uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Line Item</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Discount Given</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Limit Allowed</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Over By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {quote.lines.map((l) => {
                  const isOver = l.overage_pts > 0;
                  return (
                    <tr
                      key={l.odoo_line_id}
                      className={isOver ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-elevated/30'}
                    >
                      <td className="py-2.5 px-4 font-medium text-text-primary">{l.product_name}</td>
                      <td className="py-2.5 px-4 text-center tabular-nums">{formatPct(l.discount_pct)}</td>
                      <td className="py-2.5 px-4 text-center tabular-nums text-text-muted">{formatPct(l.ceiling_pct)}</td>
                      <td className="py-2.5 px-4 text-center font-bold">
                        {isOver ? (
                          <span className="text-red-700 bg-red-100/80 px-2 py-0.5 rounded-chip text-[11px]">+{l.overage_pts.toFixed(0)} pt OVER</span>
                        ) : (
                          <span className="text-emerald-700">0 pt – OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 pt-1">
            <span className="text-xs font-semibold text-text-secondary block">Non-Discount Risk Factors:</span>
            <ul className="list-disc list-inside text-xs text-text-muted space-y-1">
              {risk.factors
                .filter((f) => f.factor_type !== 'DISCOUNT_EXCESS')
                .map((f, i) => (
                  <li key={i}>
                    {f.reason} (<strong className="text-text-primary">+{f.contribution} pts</strong>)
                  </li>
                ))}
            </ul>
          </div>

          <HintStrip>
            Worst single line (8pt over) plus overall pattern across the order sets the blended score. One bad line is enough to require approval.
          </HintStrip>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-text-primary">
            Audit Trail &amp; Approver Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-input border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-text-secondary border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">User</th>
                  <th className="py-2.5 px-4 font-semibold">Action</th>
                  <th className="py-2.5 px-4 font-semibold">Date</th>
                  <th className="py-2.5 px-4 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {timeline.map((e) => (
                  <tr key={e.id} className="hover:bg-elevated/30">
                    <td className="py-2.5 px-4 font-medium text-text-primary">{e.actor_name}</td>
                    <td className="py-2.5 px-4 font-semibold text-brand">{e.event_type}</td>
                    <td className="py-2.5 px-4 text-text-muted">{formatAbsoluteDate(e.created_at)}</td>
                    <td className="py-2.5 px-4 text-text-secondary">{e.summary || e.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DecisionModal
        open={decisionModalOpen}
        onOpenChange={setDecisionModalOpen}
        decisionType={decisionType}
        onConfirm={handleConfirmDecision}
        errorMessage={toastError}
        isLoading={
          approveMutation.isPending ||
          rejectMutation.isPending ||
          returnMutation.isPending ||
          escalateMutation.isPending
        }
      />
    </div>
  );
};

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
import { ArrowLeft, CheckCircle, RotateCcw, XCircle, ArrowUpRight } from 'lucide-react';

export const ApprovalDetailPage: React.FC = () => {
  const { dealId = 'deal_d1024_acme' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE'>('APPROVE');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data: workspace, isLoading } = useQuery({
    queryKey: queryKeys.deals.workspace(dealId),
    queryFn: () => dealsApi.getWorkspace(dealId),
  });

  const approveMutation = useMutation({
    mutationFn: (reason?: string) => approvalsApi.approve(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setDecisionModalOpen(false);
      setToastMessage('Quotation approved and unlocked in Odoo.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => approvalsApi.reject(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setDecisionModalOpen(false);
      setToastMessage('Quotation rejected.');
    },
  });

  const returnMutation = useMutation({
    mutationFn: (reason: string) => approvalsApi.returnForRevision(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setDecisionModalOpen(false);
      setToastMessage('Quotation returned to sales representative for revision.');
    },
  });

  const escalateMutation = useMutation({
    mutationFn: (reason?: string) => approvalsApi.escalate(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.workspace(dealId) });
      setDecisionModalOpen(false);
      setToastMessage('Quotation escalated.');
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

  const handleOpenDecision = (type: 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE') => {
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

  const stepperSteps = [
    { label: 'Submitted', status: 'done' as const },
    {
      label: 'Sales Manager',
      status:
        approval.state === 'APPROVED' || approval.state === 'PENDING_FINANCE'
          ? ('done' as const)
          : approval.state === 'PENDING_MANAGER'
          ? ('current' as const)
          : ('pending' as const),
    },
    {
      label: 'Finance',
      status:
        approval.state === 'APPROVED'
          ? ('done' as const)
          : approval.state === 'PENDING_FINANCE'
          ? ('current' as const)
          : ('pending' as const),
    },
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
        <div className="p-3 rounded-input bg-success/20 border border-success/50 text-success text-xs font-semibold">
          ✓ {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Approval Detail: {deal.reference} ({customer.name})
            </h1>
            <span className="px-2.5 py-0.5 rounded-chip text-xs font-bold bg-danger/20 text-danger border border-danger/40">
              Blended Risk: {risk.severity}
            </span>
            <span className="px-2.5 py-0.5 rounded-chip text-xs font-bold bg-info/20 text-info border border-info/40">
              Customer Tier: {customer.tier_code}
            </span>
            <RiskBadge score={risk.score} severity={risk.severity} />
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Order Total: <strong>{deal.amount_total ?? quote.totals.total} {deal.currency_code}</strong> · Stage: <strong>{approval.state}</strong>
          </p>
        </div>

        {/* Action Buttons */}
        {approval.can_decide && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="success"
              onClick={() => handleOpenDecision('APPROVE')}
              className="gap-1 font-bold text-xs"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="warning"
              onClick={() => handleOpenDecision('RETURN')}
              className="gap-1 font-semibold text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Return for Revision
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleOpenDecision('REJECT')}
              className="gap-1 font-semibold text-xs"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenDecision('ESCALATE')}
              className="gap-1 text-xs"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Escalate
            </Button>
          </div>
        )}
      </div>

      {/* Stepper */}
      <Card className="border-border bg-surface p-4">
        <Stepper steps={stepperSteps} />
      </Card>

      {/* Section: Why This Quote Was Flagged */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-info uppercase tracking-wider">
            Why This Quote Was Flagged
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-input border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-text-secondary border-b border-border">
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
                    <tr key={l.odoo_line_id} className="hover:bg-elevated/30">
                      <td className="py-2.5 px-4 font-medium text-text-primary">{l.product_name}</td>
                      <td className="py-2.5 px-4 text-center tabular-nums">{formatPct(l.discount_pct)}</td>
                      <td className="py-2.5 px-4 text-center tabular-nums text-text-muted">{formatPct(l.ceiling_pct)}</td>
                      <td className="py-2.5 px-4 text-center font-bold">
                        {isOver ? (
                          <span className="text-danger">+{l.overage_pts.toFixed(0)} pt OVER</span>
                        ) : (
                          <span className="text-success">0 pt – OK</span>
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

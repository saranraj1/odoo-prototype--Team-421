import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Stepper } from '@/components/data/Stepper';
import { StatusChip } from '@/components/data/StatusChip';
import { InvalidationBanner } from './InvalidationBanner';
import { formatPct } from '@/lib/format';
import type { DealWorkspace } from '@/api/types';

interface GuardianPanelProps {
  workspace: DealWorkspace;
  onHoverFactor?: (lineId: number | null) => void;
}

export const GuardianPanel: React.FC<GuardianPanelProps> = ({
  workspace,
  onHoverFactor,
}) => {
  const navigate = useNavigate();
  const { risk, approval, quote, deal } = workspace;

  const isInvalidated =
    approval.state === 'INVALIDATED' ||
    (risk.previous_score !== null &&
      risk.previous_score !== undefined &&
      risk.score > risk.previous_score);

  // Stepper progression
  const stepperSteps = [
    {
      label: 'Submitted',
      status: 'done' as const,
    },
    {
      label: 'Sales Manager',
      status:
        approval.state === 'APPROVED' || approval.state === 'PENDING_FINANCE'
          ? ('done' as const)
          : approval.state === 'PENDING_MANAGER'
          ? ('current' as const)
          : ('pending' as const),
    },
    ...(approval.level === 'MANAGER_AND_FINANCE'
      ? [
          {
            label: 'Finance',
            status:
              approval.state === 'APPROVED'
                ? ('done' as const)
                : approval.state === 'PENDING_FINANCE'
                ? ('current' as const)
                : ('pending' as const),
          },
        ]
      : []),
    {
      label: 'Confirmed',
      status: deal.status === 'CONFIRMED' ? ('done' as const) : ('pending' as const),
    },
  ];

  return (
    <div className="sticky top-20 rounded-card border border-border bg-surface p-5 space-y-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-brand" />
          <h3 className="font-bold text-sm tracking-tight text-text-primary">DEAL GUARDIAN</h3>
        </div>

        {risk.severity === 'HIGH' ? (
          <span className="flex items-center gap-1.5 rounded-chip bg-danger/20 border border-danger/40 px-2.5 py-0.5 text-[11px] font-bold text-danger">
            <span className="h-2 w-2 rounded-full bg-danger animate-ping" />
            ACTION REQUIRED
          </span>
        ) : risk.severity === 'MEDIUM' ? (
          <span className="flex items-center gap-1.5 rounded-chip bg-warning/20 border border-warning/40 px-2.5 py-0.5 text-[11px] font-bold text-warning">
            REVIEW
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-chip bg-success/20 border border-success/40 px-2.5 py-0.5 text-[11px] font-bold text-success">
            SAFE
          </span>
        )}
      </div>

      {isInvalidated && <InvalidationBanner />}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 bg-elevated/40 p-3 rounded-input border border-border/60">
        <div>
          <span className="text-[10px] font-semibold text-text-muted uppercase">Risk Score</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-black tabular-nums text-text-primary">
              {risk.score.toFixed(1)}
            </span>
            {risk.previous_score !== null && risk.previous_score !== undefined && (
              <span className="text-xs font-bold text-danger tabular-nums">
                ({risk.previous_score.toFixed(0)} → {risk.score.toFixed(0)} ↑)
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-semibold text-text-muted uppercase">Blended Margin</span>
          <div className="mt-0.5">
            <span
              className={`text-xl font-bold tabular-nums ${
                quote.totals.margin_pct >= 20 ? 'text-success' : 'text-danger'
              }`}
            >
              {formatPct(quote.totals.margin_pct)}
            </span>
          </div>
        </div>
      </div>

      {/* Approval Status */}
      <div className="flex items-center justify-between text-xs py-1 border-b border-border/60">
        <span className="text-text-secondary">Required Routing:</span>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-text-primary">
            {approval.level === 'MANAGER_AND_FINANCE'
              ? 'Manager + Finance'
              : approval.level === 'MANAGER'
              ? 'Manager Only'
              : 'Auto-Approved'}
          </span>
          <StatusChip status={approval.state} />
        </div>
      </div>

      {/* Why Section */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
          Why This Deal Was Flagged
        </span>

        {risk.factors && risk.factors.length > 0 ? (
          <div className="space-y-2">
            {risk.factors.map((f, idx) => {
              const lineMatch = f.source_reference?.match(/line:(\d+)/);
              const lineId = lineMatch ? Number(lineMatch[1]) : null;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => lineId && onHoverFactor && onHoverFactor(lineId)}
                  onMouseLeave={() => onHoverFactor && onHoverFactor(null)}
                  className="flex items-start gap-2.5 p-2.5 rounded-input bg-elevated/60 hover:bg-elevated border border-border/80 text-xs transition-colors cursor-help"
                >
                  <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 leading-snug">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-text-primary text-[11px]">
                        {f.reason}
                      </span>
                      <span className="rounded bg-danger/20 text-danger px-1 py-0.2 text-[10px] font-bold tabular-nums shrink-0">
                        +{f.contribution.toFixed(1)} pts
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5 text-xs text-success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Discounts within category ceilings</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Full inventory available in main warehouse</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Healthy blended margin floor (&gt;20%)</span>
            </div>
          </div>
        )}
      </div>

      {/* Approval Progress Stepper */}
      <div className="pt-2 border-t border-border/60">
        <span className="text-[11px] font-semibold text-text-muted uppercase mb-3 block">
          Approval Progress
        </span>
        <Stepper steps={stepperSteps} />
      </div>

      {/* Full Assessment link */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => navigate(`/quotations/${deal.id}/assessments/${risk.assessment_id}`)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-brand hover:underline rounded-input bg-elevated/40 border border-border"
        >
          <span>View Full Assessment &amp; Policy Snapshot</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

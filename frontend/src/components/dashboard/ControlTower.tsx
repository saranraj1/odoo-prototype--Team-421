import React from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { Badge, Button, Card } from '../ui';
import { 
  ShieldAlert, 
  ShieldCheck, 
  TrendingUp, 
  AlertOctagon, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  CheckCircle2, 
  Layers,
  ArrowUpRight,
  ExternalLink
} from 'lucide-react';

interface ControlTowerProps {
  onSelectDeal: (dealId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const ControlTower: React.FC<ControlTowerProps> = ({ onSelectDeal, onNavigateTab }) => {
  const { deals, allEvaluations, setActiveDealId } = useDealFlow();

  // Metrics
  const totalGovernedVolume = deals.reduce((sum, d) => sum + (allEvaluations[d.id]?.netTotal || 0), 0);
  const highRiskDeals = deals.filter((d) => (allEvaluations[d.id]?.blendedRiskScore ?? 0) >= 60);
  const pendingApprovals = deals.filter(
    (d) => d.state === 'PENDING_MANAGER' || d.state === 'PENDING_FINANCE' || d.state === 'INVALIDATED'
  );
  const avgMargin = deals.length > 0
    ? deals.reduce((sum, d) => sum + (allEvaluations[d.id]?.marginPercent || 0), 0) / deals.length
    : 0;

  const handleOpenDeal = (dealId: string) => {
    setActiveDealId(dealId);
    onSelectDeal(dealId);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-brand-600" />
            Deal Control Tower
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Executive oversight, portfolio deal health, pricing anomaly detection, and commercial intervention queue
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigateTab('approvals')}
          >
            Open Approval Center ({pendingApprovals.length})
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">
              Governed Volume
            </span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-slate-900 tabular-nums">
            ₹{(totalGovernedVolume / 100000).toFixed(1)}L
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Across {deals.length} active ERP quotations
          </div>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">
              Pending Approvals
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-amber-600 tabular-nums">
            {pendingApprovals.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Requires Manager / Finance sign-off
          </div>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">
              At-Risk Deals
            </span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-rose-600 tabular-nums">
            {highRiskDeals.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Risk score &gt; 60/100 threshold
          </div>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">
              Avg Gross Margin
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-600 tabular-nums">
            {avgMargin.toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Corporate target: 20.0%
          </div>
        </Card>
      </div>

      {/* Prominent Needs Your Attention Action Queue */}
      <Card className="p-5 border-slate-300 shadow-sm bg-white">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-rose-100 text-rose-700">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Action Queue — Needs Your Attention
              </h2>
              <span className="text-xs text-slate-500">
                Prioritized items requiring managerial review or intervention
              </span>
            </div>
          </div>
          <Badge variant="danger" size="sm">
            Actions First, Analytics Second
          </Badge>
        </div>

        <div className="divide-y divide-slate-100 mt-2">
          {deals.map((deal) => {
            const ev = allEvaluations[deal.id];
            const isHighRisk = (ev?.blendedRiskScore ?? 0) >= 60;
            const isStalled = ev?.factors.some(f => f.category === 'DEAL_DELAY');
            const isInvalidated = deal.state === 'INVALIDATED';

            return (
              <div
                key={deal.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">
                    {isInvalidated ? '🔴' : isHighRisk ? '🔴' : isStalled ? '🟠' : '🟡'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {deal.customerName}
                      </span>
                      <Badge variant="neutral" size="sm">
                        {deal.customerTier}
                      </Badge>
                      <span className="text-xs font-mono text-slate-400">
                        #{deal.dealNumber}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-0.5">
                      {isInvalidated ? (
                        <strong className="text-rose-600">Customer counter-offer received. Prior approval invalidated.</strong>
                      ) : isHighRisk ? (
                        <span>Finance approval required (Service discount concession exceeds 10% policy ceiling).</span>
                      ) : isStalled ? (
                        <span>Quote inactive for 5+ days without customer progression.</span>
                      ) : (
                        <span>Standard deal progression within tier guidelines.</span>
                      )}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 font-mono">
                      <span>₹{Math.round(ev?.netTotal || 0).toLocaleString('en-IN')}</span>
                      <span>·</span>
                      <span className={isHighRisk ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                        Risk {ev?.blendedRiskScore}/100
                      </span>
                      <span>·</span>
                      <span>Margin {ev?.marginPercent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant={isInvalidated || isHighRisk ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => handleOpenDeal(deal.id)}
                  >
                    <span>{isInvalidated ? 'Review Counteroffer' : isHighRisk ? 'Review Deal' : 'Open Cockpit'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Deal Health & Top Risks Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Health Categorizer */}
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Deal Health Distribution
          </h3>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="font-semibold text-xs text-emerald-900">HEALTHY (Risk 0 - 29)</span>
              </div>
              <span className="font-mono font-bold text-emerald-800 text-sm">
                {deals.filter(d => (allEvaluations[d.id]?.blendedRiskScore ?? 0) < 30).length} Deals
              </span>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="font-semibold text-xs text-amber-900">WATCH (Risk 30 - 59)</span>
              </div>
              <span className="font-mono font-bold text-amber-800 text-sm">
                {deals.filter(d => {
                  const s = allEvaluations[d.id]?.blendedRiskScore ?? 0;
                  return s >= 30 && s < 60;
                }).length} Deals
              </span>
            </div>

            <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span className="font-semibold text-xs text-rose-900">AT RISK (Risk 60 - 100)</span>
              </div>
              <span className="font-mono font-bold text-rose-800 text-sm">
                {highRiskDeals.length} Deals
              </span>
            </div>
          </div>
        </Card>

        {/* Top Risks Table */}
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Top Commercial Risk Drivers
          </h3>

          <div className="divide-y divide-slate-100 text-xs">
            {deals.map((deal) => {
              const ev = allEvaluations[deal.id];
              const topFactor = ev?.factors[0];

              return (
                <div key={deal.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">{deal.customerName}</span>
                    <span className="text-slate-500 text-[11px]">{topFactor?.name || 'Compliant'}</span>
                  </div>
                  <div className="text-right">
                    <Badge variant={(ev?.blendedRiskScore ?? 0) >= 60 ? 'danger' : 'warning'}>
                      Risk {ev?.blendedRiskScore}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

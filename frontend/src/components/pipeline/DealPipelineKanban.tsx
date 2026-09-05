import React from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { Badge, Card } from '../ui';
import { TrendingUp, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

interface DealPipelineKanbanProps {
  onSelectDeal: (dealId: string) => void;
}

export const DealPipelineKanban: React.FC<DealPipelineKanbanProps> = ({ onSelectDeal }) => {
  const { deals, allEvaluations, setActiveDealId } = useDealFlow();

  const stages = [
    { key: 'DRAFT', title: 'DRAFT', color: 'border-slate-300' },
    { key: 'APPROVAL', title: 'APPROVAL', color: 'border-amber-400' },
    { key: 'NEGOTIATION', title: 'NEGOTIATION', color: 'border-purple-400' },
    { key: 'READY', title: 'READY / CONFIRMED', color: 'border-emerald-400' },
  ];

  const mapDealToStage = (deal: typeof deals[0]): 'DRAFT' | 'APPROVAL' | 'NEGOTIATION' | 'READY' => {
    if (deal.state === 'CONFIRMED' || deal.state === 'APPROVED') return 'READY';
    if (deal.negotiationActive || deal.state === 'INVALIDATED') return 'NEGOTIATION';
    if (deal.state === 'PENDING_MANAGER' || deal.state === 'PENDING_FINANCE') return 'APPROVAL';
    return 'DRAFT';
  };

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand-600" />
          Deal Pipeline
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Kanban pipeline organized by commercial governance stage with visible risk metrics before opening
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => mapDealToStage(d) === stage.key);

          return (
            <div key={stage.key} className="bg-slate-100/70 rounded-xl p-3 border border-slate-200/80">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {stage.title}
                </span>
                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                  {stageDeals.length}
                </span>
              </div>

              <div className="space-y-3">
                {stageDeals.map((deal) => {
                  const ev = allEvaluations[deal.id];
                  const isHighRisk = (ev?.blendedRiskScore ?? 0) >= 60;

                  return (
                    <Card
                      key={deal.id}
                      onClick={() => {
                        setActiveDealId(deal.id);
                        onSelectDeal(deal.id);
                      }}
                      className="p-3.5 hover:shadow-md cursor-pointer border-slate-200"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-xs text-slate-900 line-clamp-1">
                          {deal.customerName}
                        </span>
                        <Badge
                          variant={isHighRisk ? 'danger' : (ev?.blendedRiskScore ?? 0) >= 30 ? 'warning' : 'success'}
                          size="sm"
                        >
                          Risk {ev?.blendedRiskScore}
                        </Badge>
                      </div>

                      <div className="mt-2 text-sm font-bold font-mono text-slate-900 tabular-nums">
                        ₹{Math.round(ev?.netTotal || 0).toLocaleString('en-IN')}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-mono">{deal.dealNumber}</span>
                        <span>Margin {ev?.marginPercent.toFixed(1)}%</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

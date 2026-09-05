import React from 'react';
import { DealContext } from '../../types';
import { Badge } from '../ui';
import { AlertOctagon, CheckCircle2, ArrowRight } from 'lucide-react';

interface BaselineDiffViewerProps {
  deal: DealContext;
}

export const BaselineDiffViewer: React.FC<BaselineDiffViewerProps> = ({ deal }) => {
  const baseline = deal.approvedBaseline;

  if (!baseline) {
    return (
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
        No approved baseline recorded yet. Initial approval required before baseline comparisons can be calculated.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
        <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Material Commercial Deterioration Detected</span>
          <span>
            The customer counteroffer requested higher discounts than the previously approved executive baseline. Prior sign-off was automatically invalidated by Deal Guardian.
          </span>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Item</th>
              <th className="py-2.5 px-3 text-right">Approved Baseline</th>
              <th className="py-2.5 px-3 text-center"></th>
              <th className="py-2.5 px-3 text-right">Proposed Terms</th>
              <th className="py-2.5 px-3 text-right">Variance Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deal.lines.map((line) => {
              const bLine = baseline.lines.find((b) => b.productId === line.productId);
              const baselineDiscount = bLine ? bLine.discountPercent : 0;
              const currentDiscount = line.discountPercent;
              const isBreached = currentDiscount > baselineDiscount + 0.01;

              return (
                <tr key={line.id} className={isBreached ? 'bg-rose-50/40' : ''}>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {line.name}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {baselineDiscount.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400">
                    <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    <span className={isBreached ? 'text-rose-600' : 'text-slate-800'}>
                      {currentDiscount.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {isBreached ? (
                      <Badge variant="danger" size="sm">
                        +{(currentDiscount - baselineDiscount).toFixed(1)}% Drift
                      </Badge>
                    ) : (
                      <span className="text-emerald-600 text-[11px] font-medium">Unchanged</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div>
          <span className="text-slate-500 block">Baseline Approval Authority</span>
          <span className="font-semibold text-slate-800">{baseline.approvedBy}</span>
          <span className="text-[10px] text-slate-400 block font-mono">
            {new Date(baseline.capturedAt).toLocaleString()}
          </span>
        </div>
        <div className="text-right">
          <span className="text-slate-500 block">Baseline Gross Margin</span>
          <span className="font-mono font-bold text-slate-800">{baseline.marginPercent.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

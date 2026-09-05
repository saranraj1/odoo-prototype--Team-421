import React from 'react';
import { formatMoney, formatPct } from '@/lib/format';
import type { QuoteTotals } from '@/api/types';

interface TotalsSummaryProps {
  totals: QuoteTotals;
  currency?: string;
}

export const TotalsSummary: React.FC<TotalsSummaryProps> = ({ totals, currency = 'INR' }) => {
  const isHealthyMargin = totals.margin_pct >= 20.0;

  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-2 text-xs">
      <div className="flex justify-between text-text-secondary">
        <span>List Price Total:</span>
        <span className="tabular-nums">{formatMoney(totals.list, currency)}</span>
      </div>

      <div className="flex justify-between text-text-secondary">
        <span>Net Value:</span>
        <span className="tabular-nums">{formatMoney(totals.net, currency)}</span>
      </div>

      <div className="flex justify-between text-text-secondary">
        <span>Tax (GST / VAT):</span>
        <span className="tabular-nums">{formatMoney(totals.tax, currency)}</span>
      </div>

      <div className="border-t border-border pt-2 flex justify-between font-bold text-sm text-text-primary">
        <span>Grand Total:</span>
        <span className="tabular-nums text-brand">{formatMoney(totals.total, currency)}</span>
      </div>

      <div className="border-t border-border pt-2 flex justify-between items-center">
        <span className="font-semibold text-text-secondary">Blended Margin:</span>
        <div className="text-right">
          <span
            className={`font-bold tabular-nums text-xs ${
              isHealthyMargin ? 'text-success' : 'text-danger'
            }`}
          >
            {formatPct(totals.margin_pct)}
          </span>
          <span className="text-[10px] text-text-muted ml-1.5">
            ({formatMoney(totals.margin_amount, currency)})
          </span>
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-text-muted pt-1">
        <span>One-Time Hardware/Services:</span>
        <span className="tabular-nums">{formatMoney(totals.one_time, currency)}</span>
      </div>

      <div className="flex justify-between text-[11px] text-text-muted">
        <span>Recurring (1st Billing Cycle):</span>
        <span className="tabular-nums">{formatMoney(totals.recurring_first_cycle, currency)}</span>
      </div>
    </div>
  );
};

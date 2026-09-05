import React from 'react';
import { MessageSquare } from 'lucide-react';
import { formatMoney, formatPct } from '@/lib/format';

interface PortalLine {
  line_id: number;
  product_name: string;
  qty: number;
  price_unit: number;
  discount_pct: number;
  net_value: number;
}

interface PortalLinesTableProps {
  lines: PortalLine[];
  currency?: string;
  onCommentClick?: (lineId: number, productName: string) => void;
}

export const PortalLinesTable: React.FC<PortalLinesTableProps> = ({
  lines,
  currency = 'INR',
  onCommentClick,
}) => {
  return (
    <div className="rounded-card border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-elevated text-text-secondary border-b border-border">
            <tr>
              <th className="py-3 px-4 font-semibold">Product Description</th>
              <th className="py-3 px-4 font-semibold text-center w-24">Quantity</th>
              <th className="py-3 px-4 font-semibold text-right">Unit Price</th>
              <th className="py-3 px-4 font-semibold text-center w-28">Discount</th>
              <th className="py-3 px-4 font-semibold text-right">Line Total</th>
              <th className="py-3 px-3 text-center w-12">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {lines.map((line) => (
              <tr key={line.line_id} className="hover:bg-elevated/40 transition-colors">
                <td className="py-3 px-4 font-medium text-text-primary">{line.product_name}</td>
                <td className="py-3 px-4 text-center tabular-nums">{line.qty}</td>
                <td className="py-3 px-4 text-right tabular-nums text-text-secondary">
                  {formatMoney(line.price_unit, currency)}
                </td>
                <td className="py-3 px-4 text-center tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                  {formatPct(line.discount_pct)}
                </td>
                <td className="py-3 px-4 text-right font-bold tabular-nums text-text-primary">
                  {formatMoney(line.net_value, currency)}
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => onCommentClick && onCommentClick(line.line_id, line.product_name)}
                    className="p-1 text-text-muted hover:text-emerald-600 transition-colors rounded-chip"
                    title="Comment on line"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

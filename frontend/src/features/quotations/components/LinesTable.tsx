import React, { useState, useEffect } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { HintStrip } from '@/components/data/HintStrip';
import { formatMoney, formatPct } from '@/lib/format';
import type { DealLine } from '@/api/types';

interface LinesTableProps {
  lines: DealLine[];
  currency?: string;
  orderDiscountPct: number;
  onUpdateLine: (lineId: number, patch: { qty?: number; discount_pct?: number }) => void;
  onDeleteLine: (lineId: number) => void;
  onUpdateOrderDiscount: (discountPct: number) => void;
  highlightedLineId?: number | null;
  readOnly?: boolean;
}

export const LinesTable: React.FC<LinesTableProps> = ({
  lines,
  currency = 'INR',
  orderDiscountPct,
  onUpdateLine,
  onDeleteLine,
  onUpdateOrderDiscount,
  highlightedLineId,
  readOnly = false,
}) => {
  const [localDiscounts, setLocalDiscounts] = useState<Record<number, number>>({});

  useEffect(() => {
    const init: Record<number, number> = {};
    lines.forEach((l) => {
      init[l.odoo_line_id] = l.discount_pct;
    });
    setLocalDiscounts(init);
  }, [lines]);

  const handleDiscountChange = (lineId: number, val: number) => {
    setLocalDiscounts((prev) => ({ ...prev, [lineId]: val }));
    // Debounce callback
    const timer = setTimeout(() => {
      onUpdateLine(lineId, { discount_pct: val });
    }, 400);
    return () => clearTimeout(timer);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-card border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4 text-center w-28">Qty</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-center w-28">Discount</th>
                <th className="py-3 px-4 text-center w-20">Limit</th>
                <th className="py-3 px-4 text-center w-24">Status</th>
                <th className="py-3 px-4 text-right">Margin</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                {!readOnly && <th className="py-3 px-2 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {lines.map((l) => {
                const isOver = l.overage_pts > 0;
                const isHighlighted = highlightedLineId === l.odoo_line_id;

                return (
                  <tr
                    key={l.odoo_line_id}
                    className={`transition-colors ${
                      isHighlighted ? 'bg-sky-50/50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text-primary">{l.product_name}</div>
                      {l.is_recurring && (
                        <span className="inline-block mt-0.5 text-[10px] text-sky-700 font-medium">
                          Recurring · Monthly
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {!readOnly ? (
                        <div className="inline-flex items-center rounded-md border border-slate-200 bg-white shadow-2xs">
                          <button
                            type="button"
                            onClick={() => onUpdateLine(l.odoo_line_id, { qty: Math.max(1, l.qty - 1) })}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-l-md transition-colors"
                            disabled={l.qty <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-semibold tabular-nums text-slate-800">{l.qty}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateLine(l.odoo_line_id, { qty: l.qty + 1 })}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-r-md transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="tabular-nums font-medium">{l.qty}</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right tabular-nums text-text-secondary">
                      {formatMoney(l.price_unit, currency)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {!readOnly ? (
                        <div className="relative inline-flex items-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={localDiscounts[l.odoo_line_id] ?? l.discount_pct}
                            onChange={(e) =>
                              handleDiscountChange(l.odoo_line_id, Number(e.target.value))
                            }
                            className="w-16 h-7 text-right pr-4 rounded-md border border-slate-200 bg-white text-xs font-semibold tabular-nums focus:border-sky-600 focus:ring-1 focus:ring-sky-600/20 focus:outline-none shadow-2xs"
                          />
                          <span className="absolute right-1.5 text-[11px] font-medium text-slate-400 pointer-events-none">%</span>
                        </div>
                      ) : (
                        <span className="tabular-nums font-semibold">{formatPct(l.discount_pct)}</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center tabular-nums text-text-muted">
                      {formatPct(l.ceiling_pct)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isOver ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-chip text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">
                          OVER (+{l.overage_pts.toFixed(0)}pt)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-chip text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          OK
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className={l.margin < 0 ? 'text-red-600 font-semibold' : 'text-slate-700 font-medium'}>
                        {formatMoney(l.margin, currency)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-semibold tabular-nums text-text-primary">
                      {formatMoney(l.net_value, currency)}
                    </td>

                    {!readOnly && (
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => onDeleteLine(l.odoo_line_id)}
                          className="p-1 text-text-muted hover:text-danger transition-colors"
                          title="Remove line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* Order Level Discount Row */}
              <tr className="bg-elevated/20 border-t border-border/80">
                <td colSpan={3} className="py-2.5 px-4 font-semibold text-text-secondary">
                  Order-Level Virtual Header Discount
                </td>
                <td className="py-2.5 px-4 text-center">
                  {!readOnly ? (
                    <div className="relative inline-flex items-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={orderDiscountPct}
                        onChange={(e) => onUpdateOrderDiscount(Number(e.target.value))}
                        className="w-16 h-7 text-right pr-4 rounded border border-border bg-elevated text-xs font-semibold tabular-nums focus:border-brand focus:outline-none"
                      />
                      <span className="absolute right-1.5 text-[11px] text-text-muted">%</span>
                    </div>
                  ) : (
                    <span className="tabular-nums font-semibold">{formatPct(orderDiscountPct)}</span>
                  )}
                </td>
                <td colSpan={readOnly ? 4 : 5} className="py-2.5 px-4 text-xs text-text-muted italic">
                  Compounded across all lines before policy evaluation
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <HintStrip>
        Discount is checked against each line's own limit live, as soon as it is entered, not only at submit time.
      </HintStrip>
    </div>
  );
};

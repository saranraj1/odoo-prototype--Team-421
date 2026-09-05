import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RiskBadge } from '@/components/data/RiskBadge';
import { StatusChip } from '@/components/data/StatusChip';
import { formatMoney } from '@/lib/format';
import { Inbox } from 'lucide-react';

interface KanbanColumn {
  status: string;
  items: any[];
}

interface QuotationKanbanProps {
  columns: KanbanColumn[];
}

export const QuotationKanban: React.FC<QuotationKanbanProps> = ({ columns }) => {
  const navigate = useNavigate();

  const getColumnTitle = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Draft';
      case 'PENDING_APPROVAL':
        return 'Pending Approval';
      case 'APPROVED':
        return 'Approved';
      case 'UNDER_NEGOTIATION':
        return 'Negotiation';
      case 'CONFIRMED':
        return 'Confirmed';
      default:
        return status;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col.status}
          className="flex flex-col rounded-card border border-border bg-surface/50 p-3 min-w-[200px]"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
              {getColumnTitle(col.status)}
            </span>
            <span className="rounded-chip bg-elevated px-2 py-0.5 text-[10px] font-semibold text-text-muted">
              {col.items.length}
            </span>
          </div>

          <div className="flex-1 space-y-2.5 min-h-[300px]">
            {col.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-input gap-1.5 min-h-[140px]">
                <Inbox className="h-4 w-4 text-slate-300" />
                <span>No quotations</span>
              </div>
            ) : (
              col.items.map((deal) => (
                <div
                  key={deal.id}
                  onClick={() => navigate(`/quotations/${deal.id}`)}
                  className="rounded-input border border-border bg-surface p-3 shadow-xs hover:border-brand/50 hover:bg-elevated/40 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-xs text-text-primary line-clamp-1">
                      {deal.partner_name_cache || 'Acme Corp'}
                    </span>
                    <RiskBadge score={deal.current_risk_score} severity={deal.current_severity} />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>{deal.reference}</span>
                    <span className="font-semibold text-text-primary tabular-nums">
                      {formatMoney(deal.amount_total_cache ?? 558000, deal.currency_code)}
                    </span>
                  </div>

                  <div className="pt-1.5 flex items-center justify-between border-t border-border/40 gap-2">
                    <div className="min-w-0 flex-1">
                      <StatusChip status={deal.approval_state || deal.status} className="truncate max-w-[135px]" />
                    </div>
                    <div className="h-5 w-5 shrink-0 rounded-chip bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                      {deal.owner?.name?.charAt(0) || 'R'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

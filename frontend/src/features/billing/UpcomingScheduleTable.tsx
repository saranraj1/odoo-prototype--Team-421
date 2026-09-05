import React from 'react';
import { formatMoney } from '@/lib/format';

export interface ScheduleItem {
  period?: number;
  period_start?: string;
  period_end?: string;
  due_date: string;
  amount: number;
  status: string;
}

interface UpcomingScheduleTableProps {
  schedule: ScheduleItem[];
  currency?: string;
}

export const UpcomingScheduleTable: React.FC<UpcomingScheduleTableProps> = ({
  schedule,
  currency = 'INR',
}) => {
  if (!schedule || schedule.length === 0) {
    return <p className="text-xs text-text-muted italic py-2">No upcoming billing periods scheduled.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-border/60 mt-2">
      <table className="w-full text-left text-xs">
        <thead className="bg-elevated text-text-secondary border-b border-border">
          <tr>
            <th className="py-2 px-3">Period</th>
            <th className="py-2 px-3">Due Date</th>
            <th className="py-2 px-3 text-right">Amount</th>
            <th className="py-2 px-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {schedule.map((s, idx) => {
            const isCancelled = s.status?.toUpperCase() === 'CANCELLED';
            const isPaid = s.status?.toUpperCase() === 'PAID';
            return (
              <tr key={idx} className={`hover:bg-elevated/30 ${isCancelled ? 'opacity-60 bg-danger/5' : ''}`}>
                <td className="py-2 px-3 font-medium text-text-primary">Period #{s.period || idx + 1}</td>
                <td className="py-2 px-3 text-text-secondary">{s.due_date}</td>
                <td className={`py-2 px-3 text-right tabular-nums font-semibold ${isCancelled ? 'line-through text-text-muted' : ''}`}>
                  {formatMoney(s.amount, currency)}
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-chip text-[10px] font-bold ${
                      isCancelled
                        ? 'bg-danger/20 text-danger border border-danger/40'
                        : isPaid
                        ? 'bg-success/20 text-success border border-success/40'
                        : 'bg-info/20 text-info border border-info/40'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

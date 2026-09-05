import React from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { Badge } from '../ui';
import { Clock, ShieldAlert, CheckCircle2, FileEdit, AlertTriangle, Send } from 'lucide-react';

interface ApprovalTimelineProps {
  dealId?: string;
}

export const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({ dealId }) => {
  const { auditLogs, activeDealId } = useDealFlow();
  const targetId = dealId || activeDealId;

  const relevantLogs = auditLogs.filter((l) => l.dealId === targetId);

  if (relevantLogs.length === 0) {
    return (
      <div className="text-xs text-slate-400 p-4 text-center">
        No audit events recorded for this deal yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Append-Only Governance Audit Trail
        </h4>
        <span className="text-[10px] text-slate-400 font-mono">
          PostgreSQL / Odoo Immutable Event Log
        </span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {relevantLogs.map((log) => {
          const isDanger = log.badgeVariant === 'danger';
          const isSuccess = log.badgeVariant === 'success';
          const isWarning = log.badgeVariant === 'warning';

          return (
            <div key={log.id} className="relative">
              {/* Dot */}
              <div
                className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                  isDanger ? 'bg-rose-600 ring-2 ring-rose-200' :
                  isSuccess ? 'bg-emerald-600 ring-2 ring-emerald-200' :
                  isWarning ? 'bg-amber-500 ring-2 ring-amber-200' : 'bg-slate-400'
                }`}
              ></div>

              <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-slate-900">{log.summary}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                {log.details && (
                  <p className="text-slate-600 text-[11px] mt-1">
                    {log.details}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-700">{log.actor}</span>
                  <span>·</span>
                  <span className="text-slate-400">{log.actorRole}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

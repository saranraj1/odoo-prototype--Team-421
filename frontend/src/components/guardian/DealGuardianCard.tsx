import React, { useState } from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { useRole } from '../../app/providers/RoleContext';
import { RiskGauge } from './RiskGauge';
import { FactorBreakdownModal } from './FactorBreakdownModal';
import { Badge, Button, Card } from '../ui';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ArrowRight, 
  AlertOctagon, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  Zap,
  RotateCcw
} from 'lucide-react';

interface DealGuardianCardProps {
  onTriggerAction?: (actionTarget: string) => void;
}

export const DealGuardianCard: React.FC<DealGuardianCardProps> = ({ onTriggerAction }) => {
  const { activeDeal, evaluation, submitForApproval, confirmOrderInOdoo } = useDealFlow();
  const { isApprover } = useRole();
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const nba = evaluation.nextBestAction;

  const handleActionClick = () => {
    if (nba.targetAction === 'SUBMIT_APPROVAL' || nba.targetAction === 'REQUEST_REAPPROVAL') {
      submitForApproval(activeDeal.id, evaluation.requiredApprovalRole === 'FINANCE_DIRECTOR' ? 'FINANCE_DIRECTOR' : 'SALES_MANAGER');
    } else if (nba.targetAction === 'CONFIRM_ODOO_ORDER') {
      confirmOrderInOdoo(activeDeal.id);
    } else if (onTriggerAction) {
      onTriggerAction(nba.targetAction);
    }
  };

  const isSafe = evaluation.severity === 'LOW';
  const isCritical = evaluation.severity === 'HIGH' || evaluation.severity === 'CRITICAL';

  return (
    <>
      <Card className="p-5 border-slate-300 shadow-sm bg-white">
        {/* Card Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${
              isSafe ? 'bg-emerald-50 text-emerald-600' :
              isCritical ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {isSafe ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-wider uppercase text-slate-500">
                Deal Guardian
              </h3>
              <span className="text-sm font-semibold text-slate-900 block leading-tight">
                Governance Cockpit
              </span>
            </div>
          </div>

          <Badge
            variant={isSafe ? 'success' : isCritical ? 'danger' : 'warning'}
            size="md"
            className="font-bold tracking-tight"
          >
            {isSafe ? '🟢 SAFE' : isCritical ? '🔴 ACTION REQUIRED' : '🟡 WATCH'}
          </Badge>
        </div>

        {/* Core Risk Gauge */}
        <div className="py-4 flex items-center justify-between border-b border-slate-100">
          <RiskGauge score={evaluation.blendedRiskScore} severity={evaluation.severity} size="md" />

          <button
            onClick={() => setBreakdownOpen(true)}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-semibold p-1.5 rounded hover:bg-brand-50 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>View Why</span>
          </button>
        </div>

        {/* Commercial Metrics Strip */}
        <div className="grid grid-cols-2 gap-3 py-3 border-b border-slate-100">
          <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[11px] text-slate-500 block uppercase font-medium">Gross Margin</span>
            <span className={`font-mono text-base font-bold tabular-nums ${
              evaluation.marginPercent >= 25 ? 'text-emerald-700' :
              evaluation.marginPercent >= 18 ? 'text-amber-700' : 'text-rose-700'
            }`}>
              {evaluation.marginPercent.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              ₹{evaluation.grossMarginAmount.toLocaleString('en-IN')} net
            </span>
          </div>

          <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
            <span className="text-[11px] text-slate-500 block uppercase font-medium">Approval Status</span>
            <div className="text-xs font-semibold text-slate-800 mt-1 truncate">
              {activeDeal.state === 'APPROVED' ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                </span>
              ) : activeDeal.state === 'INVALIDATED' ? (
                <span className="text-rose-600 font-bold flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5" /> Invalidated
                </span>
              ) : activeDeal.state === 'PENDING_FINANCE' ? (
                <span className="text-rose-600 font-medium">Pending Finance</span>
              ) : activeDeal.state === 'PENDING_MANAGER' ? (
                <span className="text-amber-600 font-medium">Pending Manager</span>
              ) : (
                <span className="text-slate-600">Not Required</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 block">
              Tier: {evaluation.requiredApprovalRole === 'FINANCE_DIRECTOR' ? 'Finance VP' : evaluation.requiredApprovalRole === 'SALES_MANAGER' ? 'Sales Manager' : 'Standard'}
            </span>
          </div>
        </div>

        {/* Explainable Reasons Summary */}
        <div className="py-3.5 border-b border-slate-100 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Governance Conditions
          </div>

          <div className="space-y-1.5 text-xs">
            {evaluation.policyCeilingBreached ? (
              <div className="flex items-start gap-2 text-rose-700 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span>Discount exceeds approved policy ceiling</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                <span>All discounts within customer tier policy</span>
              </div>
            )}

            {evaluation.marginPercent < 20 ? (
              <div className="flex items-start gap-2 text-rose-700 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span>Gross margin below target threshold (20.0%)</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                <span>Gross margin complies with target</span>
              </div>
            )}

            {evaluation.factors.some(f => f.category === 'STOCK_FRAGMENTATION') && (
              <div className="flex items-start gap-2 text-amber-800 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <span>Inventory split required across 2 warehouses</span>
              </div>
            )}

            {activeDeal.state === 'INVALIDATED' && (
              <div className="flex items-start gap-2 text-rose-700 font-bold bg-rose-50 p-2 rounded-md border border-rose-200">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>Customer counteroffer invalidated prior baseline approval!</span>
              </div>
            )}
          </div>
        </div>

        {/* Next Best Action Callout */}
        <div className={`mt-4 p-3.5 rounded-lg border ${
          nba.priority === 'CRITICAL' ? 'bg-rose-50/90 border-rose-200 text-rose-950' :
          nba.priority === 'HIGH' ? 'bg-amber-50/90 border-amber-200 text-amber-950' :
          'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
              <Zap className={`w-3.5 h-3.5 ${
                nba.priority === 'CRITICAL' ? 'text-rose-600' :
                nba.priority === 'HIGH' ? 'text-amber-600' : 'text-slate-600'
              }`} />
              <span>Next Best Action</span>
            </div>
            <Badge
              variant={nba.priority === 'CRITICAL' ? 'danger' : nba.priority === 'HIGH' ? 'warning' : 'neutral'}
              size="sm"
            >
              {nba.priority}
            </Badge>
          </div>

          <div className="mt-1.5 font-semibold text-xs text-slate-900">
            {nba.title}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-600">
            {nba.description}
          </p>

          <div className="mt-3">
            <Button
              variant={nba.priority === 'CRITICAL' ? 'danger' : nba.priority === 'HIGH' ? 'primary' : 'secondary'}
              size="sm"
              className="w-full justify-between"
              onClick={handleActionClick}
            >
              <span>{nba.buttonLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <FactorBreakdownModal
        isOpen={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        evaluation={evaluation}
      />
    </>
  );
};

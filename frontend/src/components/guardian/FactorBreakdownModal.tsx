import React from 'react';
import { GuardianEvaluationResult } from '../../types';
import { Modal, Badge } from '../ui';
import { AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';

interface FactorBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluation: GuardianEvaluationResult;
}

export const FactorBreakdownModal: React.FC<FactorBreakdownModalProps> = ({
  isOpen,
  onClose,
  evaluation,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deal Guardian — Risk Factor Breakdown"
      subtitle={`Deterministic mathematical explainability for ${evaluation.dealId} (Evaluation Snapshot)`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {/* Score Summary Banner */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Overall Risk Score</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-3xl font-extrabold text-slate-900 tabular-nums">
                {evaluation.blendedRiskScore}
              </span>
              <span className="text-sm text-slate-400 font-medium">/ 100</span>
              <Badge
                variant={
                  evaluation.severity === 'LOW' ? 'success' :
                  evaluation.severity === 'MEDIUM' ? 'warning' : 'danger'
                }
                size="md"
              >
                {evaluation.severity}
              </Badge>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Gross Margin</div>
            <div className="font-mono text-xl font-bold text-slate-900 tabular-nums mt-1">
              {evaluation.marginPercent.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              ₹{evaluation.grossMarginAmount.toLocaleString('en-IN')} net
            </div>
          </div>
        </div>

        {/* Explainability Doctrine Note */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-sky-50 border border-sky-200/80 text-sky-900 text-xs">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p>
            <strong>Core Doctrine:</strong> Risk points are computed deterministically from approved ERP policy rules, warehouse availability, and gross margin thresholds. Zero black-box LLM hallucinations.
          </p>
        </div>

        {/* Factors Breakdown List */}
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
            Individual Contributing Factors
          </h4>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {evaluation.factors.map((factor) => {
              const isWarning = factor.scoreImpact > 10;
              return (
                <div key={factor.id} className="p-3.5 bg-white hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isWarning ? (
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-900">
                        {factor.name}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 tabular-nums">
                      +{factor.scoreImpact} pts
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 pl-6">
                    {factor.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Required Sign-Off Routing */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>Required Approval Gate:</span>
          <span className="font-semibold text-slate-900">
            {evaluation.requiredApprovalRole === 'FINANCE_DIRECTOR' ? 'Finance Director (Executive Tier)' :
             evaluation.requiredApprovalRole === 'SALES_MANAGER' ? 'Sales Manager (Supervisory Tier)' : 'Auto-Approved (Within Safe Bounds)'}
          </span>
        </div>
      </div>
    </Modal>
  );
};

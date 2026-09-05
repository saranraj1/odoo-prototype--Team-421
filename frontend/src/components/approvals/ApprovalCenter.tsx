import React, { useState } from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { useRole } from '../../app/providers/RoleContext';
import { BaselineDiffViewer } from './BaselineDiffViewer';
import { ApprovalTimeline } from './ApprovalTimeline';
import { Badge, Button, Card, Modal } from '../ui';
import { 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  AlertTriangle, 
  ShieldCheck, 
  Layers, 
  Clock, 
  FileText,
  Building2,
  ExternalLink
} from 'lucide-react';

interface ApprovalCenterProps {
  onOpenCockpit?: (dealId: string) => void;
}

export const ApprovalCenter: React.FC<ApprovalCenterProps> = ({ onOpenCockpit }) => {
  const { deals, allEvaluations, approveDeal, rejectDeal, setActiveDealId } = useDealFlow();
  const { activeRole } = useRole();

  const [selectedDealId, setSelectedDealId] = useState<string>('deal-acme-1024');
  const [activeTab, setActiveTab] = useState<'details' | 'diff' | 'timeline'>('details');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvalComment, setApprovalComment] = useState('Approved based on strategic account expansion potential.');

  const pendingDeals = deals.filter(
    (d) => d.state === 'PENDING_MANAGER' || d.state === 'PENDING_FINANCE' || d.state === 'INVALIDATED'
  );

  const currentDeal = deals.find((d) => d.id === selectedDealId) || pendingDeals[0] || deals[0];
  const evalResult = allEvaluations[currentDeal.id];

  const handleApprove = () => {
    approveDeal(
      currentDeal.id,
      activeRole === 'FINANCE_DIRECTOR' ? 'FINANCE_DIRECTOR' : 'SALES_MANAGER',
      approvalComment
    );
    setApproveModalOpen(false);
  };

  const handleReject = () => {
    rejectDeal(currentDeal.id, activeRole || 'SALES_MANAGER', rejectReason);
    setRejectModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Commercial Approval Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-tier governance review for pricing concessions, category ceiling breaches, and margin protection
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="warning" size="md">
            Pending Queue: {pendingDeals.length}
          </Badge>
          <Badge variant="danger" size="md">
            High Risk: {deals.filter(d => (allEvaluations[d.id]?.blendedRiskScore ?? 0) >= 60).length}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Pending Approvals Queue */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Approvals Requiring Review ({pendingDeals.length})
          </div>

          {pendingDeals.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">All Approvals Clear</p>
              <p className="mt-1">No commercial policy breaches or pending deals in queue.</p>
            </div>
          ) : (
            pendingDeals.map((deal) => {
              const ev = allEvaluations[deal.id];
              const isSelected = deal.id === currentDeal.id;

              return (
                <div
                  key={deal.id}
                  onClick={() => {
                    setSelectedDealId(deal.id);
                    setActiveDealId(deal.id);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-brand-500 ring-2 ring-brand-100 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {deal.customerName}
                        </span>
                        <Badge variant="info" size="sm">
                          {deal.customerTier}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-400 font-mono block mt-0.5">
                        #{deal.dealNumber} · Odoo #{deal.odooOrderId}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-slate-900 block tabular-nums">
                        ₹{Math.round(ev?.netTotal || 0).toLocaleString('en-IN')}
                      </span>
                      <Badge
                        variant={ev?.severity === 'CRITICAL' || ev?.severity === 'HIGH' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        Risk {ev?.blendedRiskScore}/100
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium">
                      Status: <strong className={deal.state === 'INVALIDATED' ? 'text-rose-600' : 'text-slate-800'}>{deal.state}</strong>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      Margin: {ev?.marginPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Active Deal Approval Inspection & Action */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-6">
            {/* Deal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    {currentDeal.customerName}
                  </h2>
                  <Badge variant={evalResult?.severity === 'HIGH' || evalResult?.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                    Risk {evalResult?.blendedRiskScore} / 100
                  </Badge>
                  {currentDeal.state === 'INVALIDATED' && (
                    <Badge variant="danger">APPROVAL INVALIDATED</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {currentDeal.title}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>Net Value: <strong className="text-slate-900 font-mono">₹{Math.round(evalResult?.netTotal || 0).toLocaleString('en-IN')}</strong></span>
                  <span>·</span>
                  <span>Gross Margin: <strong className="text-slate-900 font-mono">{evalResult?.marginPercent.toFixed(1)}%</strong></span>
                  <span>·</span>
                  <span>Rep: <strong className="text-slate-700">{currentDeal.salesRepName}</strong></span>
                </div>
              </div>

              {onOpenCockpit && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                  onClick={() => onOpenCockpit(currentDeal.id)}
                >
                  Open Cockpit
                </Button>
              )}
            </div>

            {/* Inspection Tabs */}
            <div className="flex items-center gap-2 pt-3 pb-2 border-b border-slate-100 text-xs">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeTab === 'details'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Governance Details
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeTab === 'diff'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Baseline Diff
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Audit Timeline
              </button>
            </div>

            {/* Tab Contents */}
            <div className="py-4">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {/* Why Flagged */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Why Flagged for Approval?
                    </h4>
                    <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                      {evalResult?.factors.map((f) => (
                        <div key={f.id} className="flex items-start gap-2">
                          <span className="font-bold shrink-0">•</span>
                          <span>{f.explanation} (impact: +{f.scoreImpact} pts)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Customer commentary if counteroffer */}
                  {currentDeal.customerNotes && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Customer Counteroffer Justification
                      </h4>
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 italic">
                        "{currentDeal.customerNotes}"
                      </div>
                    </div>
                  )}

                  {/* Approval Actions Strip */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<XCircle className="w-4 h-4" />}
                        onClick={() => setRejectModalOpen(true)}
                      >
                        Reject Concession
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRejectModalOpen(true)}
                      >
                        Return for Changes
                      </Button>
                    </div>

                    <Button
                      variant="success"
                      size="sm"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() => setApproveModalOpen(true)}
                    >
                      Approve Strategic Concession
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'diff' && (
                <BaselineDiffViewer deal={currentDeal} />
              )}

              {activeTab === 'timeline' && (
                <ApprovalTimeline dealId={currentDeal.id} />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Approve Concession Modal */}
      <Modal
        isOpen={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title="Approve Commercial Concession"
        subtitle={`Lock approved baseline for ${currentDeal.customerName}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Approving this deal will lock an immutable commercial baseline at <strong>{evalResult?.marginPercent.toFixed(1)}% gross margin</strong>. Any subsequent customer counteroffers exceeding these terms will automatically invalidate this approval.
          </p>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Executive Approval Rationale
            </label>
            <textarea
              rows={3}
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setApproveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" size="sm" onClick={handleApprove}>
              Confirm Approval
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject or Return Quotation"
        subtitle={`Return to ${currentDeal.salesRepName} with corrective feedback`}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Feedback &amp; Minimum Margin Requirements
            </label>
            <textarea
              rows={3}
              placeholder="State reason for rejection or acceptable discount bounds..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleReject}>
              Submit Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

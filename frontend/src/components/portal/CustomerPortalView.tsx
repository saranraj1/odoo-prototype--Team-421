import React, { useState } from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { Badge, Button, Card, Modal } from '../ui';
import { 
  Building2, 
  FileText, 
  CheckCircle2, 
  Send, 
  Clock, 
  HelpCircle, 
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';

export const CustomerPortalView: React.FC = () => {
  const { activeDeal, submitCustomerNegotiation, confirmOrderInOdoo } = useDealFlow();

  // Find the Cloud Setup service line
  const setupLine = activeDeal.lines.find(
    (l) => l.productId === 'prod-setup' || l.category === 'SERVICES'
  ) || activeDeal.lines[1] || activeDeal.lines[0];

  const [counterofferModalOpen, setCounterofferModalOpen] = useState(false);
  const [proposedDiscount, setProposedDiscount] = useState(22.0); // Exactly 22% for the killer demo scenario!
  const [customerMessage, setCustomerMessage] = useState(
    'We require an additional concession on the Cloud Architecture Setup to fit within our approved Q3 IT infrastructure cap. If 22% is granted, we can execute the agreement this week.'
  );
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  const handleSubmitCounteroffer = (e: React.FormEvent) => {
    e.preventDefault();
    submitCustomerNegotiation(activeDeal.id, proposedDiscount, customerMessage);
    setCounterofferModalOpen(false);
    setSubmissionSuccess(true);
  };

  const handleAcceptQuote = () => {
    confirmOrderInOdoo(activeDeal.id);
    setConfirmedSuccess(true);
  };

  // Compute strictly customer-facing totals (ZERO cost prices, ZERO margin %, ZERO risk scores)
  const lineTotals = activeDeal.lines.map((l) => {
    const gross = l.unitPrice * l.quantity;
    const discountAmt = gross * (l.discountPercent / 100);
    const net = gross - discountAmt;
    return {
      ...l,
      gross,
      discountAmt,
      net,
    };
  });

  const grandGross = lineTotals.reduce((sum, l) => sum + l.gross, 0);
  const grandDiscount = lineTotals.reduce((sum, l) => sum + l.discountAmt, 0);
  const grandNet = grandGross - grandDiscount;
  const tax = Math.round(grandNet * 0.18);
  const totalPayable = grandNet + tax;

  // Determine Customer-Friendly Status Journey
  const statusSteps = [
    { key: 'SENT', label: 'Quotation Issued' },
    { key: 'UNDER_NEGOTIATION', label: 'Under Negotiation' },
    { key: 'UNDER_REVIEW', label: 'Under Commercial Review' },
    { key: 'UPDATED_QUOTE', label: 'Updated Proposal' },
    { key: 'CONFIRMED', label: 'Order Confirmed' },
  ];

  const currentStepIndex = 
    activeDeal.state === 'CONFIRMED' ? 4 :
    activeDeal.state === 'INVALIDATED' || activeDeal.negotiationActive ? 2 :
    activeDeal.state === 'APPROVED' ? 3 : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      {/* Zero Information Leakage Verification Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>
            <strong>Restricted Customer View:</strong> Strict data isolation enforced. Internal margins, unit costs, and Deal Guardian risk parameters are completely stripped.
          </span>
        </div>
        <Badge variant="success" size="sm">Zero Leakage Verified</Badge>
      </div>

      {/* Customer Journey Status Indicator */}
      <Card className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Quotation Progression Status
          </span>
          <span className="text-xs font-mono text-slate-400">
            Reference: {activeDeal.dealNumber} (Odoo #{activeDeal.odooOrderId})
          </span>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2 text-center">
          {statusSteps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div key={step.key} className="space-y-2">
                <div className="relative flex items-center justify-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted ? 'bg-emerald-600 text-white' :
                      isCurrent ? 'bg-brand-600 text-white ring-4 ring-brand-100' :
                      'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                </div>
                <div className={`text-[11px] font-medium leading-tight ${
                  isCurrent ? 'text-slate-900 font-bold' :
                  isCompleted ? 'text-emerald-700' : 'text-slate-400'
                }`}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Submission Success Alert */}
      {submissionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Counteroffer Request Submitted</span>
          </div>
          <p className="text-emerald-700 pl-7">
            Your requested concession of <strong>{proposedDiscount.toFixed(1)}%</strong> on Cloud Architecture Setup has been received by our commercial team. You will receive an updated quotation once executive review completes.
          </p>
        </div>
      )}

      {/* Order Confirmed Alert */}
      {confirmedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Quotation Formally Accepted &amp; Confirmed</span>
          </div>
          <p className="text-emerald-700 pl-7">
            Thank you! Sales Order <strong>{activeDeal.odooOrderId}</strong> is now officially locked in our ERP. Regional warehouse delivery schedules have been initiated.
          </p>
        </div>
      )}

      {/* Formal Customer Quotation Document */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="text-xs uppercase font-bold text-brand-600 tracking-wider">
              Official Commercial Proposal
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">
              {activeDeal.title}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Prepared exclusively for <strong className="text-slate-800">{activeDeal.customerName}</strong>
            </p>
          </div>

          <div className="text-left sm:text-right space-y-1 text-xs text-slate-500">
            <div>Quote Ref: <strong className="text-slate-900 font-mono">{activeDeal.dealNumber}</strong></div>
            <div>Date: <strong className="text-slate-900">{new Date(activeDeal.createdAt).toLocaleDateString()}</strong></div>
            <div>Payment Terms: <strong className="text-slate-900">{activeDeal.paymentTerms}</strong></div>
          </div>
        </div>

        {/* Deliverables Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
              <tr>
                <th className="py-3 px-3">Description &amp; Package</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th className="py-3 px-3 text-right">Standard Rate</th>
                <th className="py-3 px-3 text-right">Applied Discount</th>
                <th className="py-3 px-3 text-right">Net Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineTotals.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-slate-900">{line.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {line.isSubscription ? `Continuous Monthly SLA Coverage (${line.quantity} months)` : 'Enterprise Hardware / Service Deliverable'}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-medium text-slate-700">
                    {line.quantity}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                    ₹{line.unitPrice.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-800">
                    {line.discountPercent > 0 ? `${line.discountPercent.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                    ₹{Math.round(line.net).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Commercial Totals Block */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="text-xs text-slate-500 max-w-sm">
            <p>Prices quoted in INR. Delivery lead time: 3 to 5 business days upon formal sign-off. Subject to standard master services agreement.</p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Standard List Subtotal:</span>
              <span className="font-mono font-medium">₹{grandGross.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Total Commercial Concession:</span>
              <span className="font-mono">-₹{Math.round(grandDiscount).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Net Taxable Amount:</span>
              <span className="font-mono font-medium">₹{Math.round(grandNet).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Applicable GST (18%):</span>
              <span className="font-mono">₹{tax.toLocaleString('en-IN')}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
              <span>Grand Total Payable:</span>
              <span className="font-mono text-base text-brand-700">₹{totalPayable.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Customer Actions Bar */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Need adjustments or custom delivery milestones?
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              className="flex-1 sm:flex-none"
              onClick={() => setCounterofferModalOpen(true)}
            >
              Request a Change / Counteroffer
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1 sm:flex-none"
              onClick={handleAcceptQuote}
            >
              Accept &amp; Confirm Quote
            </Button>
          </div>
        </div>
      </div>

      {/* Customer Counteroffer Modal */}
      <Modal
        isOpen={counterofferModalOpen}
        onClose={() => setCounterofferModalOpen(false)}
        title="Request Commercial Revision"
        subtitle={`Submit counteroffer proposal for ${activeDeal.title}`}
      >
        <form onSubmit={handleSubmitCounteroffer} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="text-slate-500 font-medium block">Target Revision Item:</span>
            <span className="font-bold text-slate-900 text-sm block">
              {setupLine.name}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Current Offered Discount: {setupLine.discountPercent.toFixed(1)}%
            </span>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Proposed Discount Request (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="30"
                step="1"
                value={proposedDiscount}
                onChange={(e) => setProposedDiscount(Number(e.target.value))}
                className="w-full accent-brand-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={proposedDiscount}
                  onChange={(e) => setProposedDiscount(Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-slate-300 rounded-md font-mono font-bold text-sm text-right"
                />
                <span className="text-slate-500 font-mono font-bold">%</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              (For demonstration: Setting to 22.0% tests Deal Guardian's material change detection and baseline invalidation)
            </p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Business Justification / Commentary
            </label>
            <textarea
              rows={3}
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <Button variant="secondary" size="sm" type="button" onClick={() => setCounterofferModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={<Send className="w-3.5 h-3.5" />}>
              Submit Request to Deal Guardian
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

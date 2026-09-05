import React, { useState } from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { useRole } from '../../app/providers/RoleContext';
import { DealGuardianCard } from '../guardian/DealGuardianCard';
import { Badge, Button, Card, Modal } from '../ui';
import { CATALOG_PRODUCTS } from '../../data/catalog';
import { getEffectiveCeiling } from '../../data/policies';
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  Layers, 
  Send, 
  FileCheck, 
  Building2, 
  Clock, 
  Coins, 
  ArrowUpRight, 
  CheckCircle,
  AlertCircle,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

interface QuoteBuilderProps {
  onNavigateTab?: (tab: string) => void;
}

export const QuoteBuilder: React.FC<QuoteBuilderProps> = ({ onNavigateTab }) => {
  const { 
    activeDeal, 
    evaluation, 
    recommendations,
    updateLineDiscount, 
    updateLineQuantity, 
    addLineFromRecommendation, 
    addProductToDeal, 
    removeLineItem,
    submitForApproval,
    discountErrorToast,
    clearDiscountError,
  } = useDealFlow();

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [sentToast, setSentToast] = useState(false);

  const tierMaxDiscount = activeDeal.customerTier === 'GOLD' ? 15 : activeDeal.customerTier === 'SILVER' ? 10 : 5;

  const handleSaveDraft = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleSendToCustomer = () => {
    setSentToast(true);
    setTimeout(() => setSentToast(false), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Sent Notification Toast */}
      {sentToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-lg shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-brand-400" />
          <span>Quotation published to B2B Customer Portal for {activeDeal.customerName}. Customer can sign in at /customer-login.</span>
        </div>
      )}
      {/* Save Notification Toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-lg shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Quotation draft saved and synced with Odoo ERP (ID: {activeDeal.odooOrderId})</span>
        </div>
      )}

      {/* Explicit Discount Violation Banner */}
      {discountErrorToast && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between text-rose-900 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-rose-200 rounded-lg text-rose-800">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-rose-700">Policy Violation Rejected</div>
              <div className="text-xs font-semibold mt-0.5">{discountErrorToast}</div>
            </div>
          </div>
          <button
            onClick={clearDiscountError}
            className="text-xs text-rose-700 hover:text-rose-900 font-bold px-2.5 py-1 bg-rose-100 hover:bg-rose-200 rounded-lg cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Deal Context Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-brand-50 text-brand-700 rounded-xl border border-brand-100/80 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  {activeDeal.customerName}
                </h1>
                <Badge variant={activeDeal.customerTier === 'GOLD' ? 'warning' : activeDeal.customerTier === 'SILVER' ? 'neutral' : 'info'} size="md">
                  {activeDeal.customerTier} TIER (MAX {tierMaxDiscount}.0%)
                </Badge>
                <Badge 
                  variant={
                    activeDeal.state === 'APPROVED' ? 'success' :
                    activeDeal.state === 'INVALIDATED' ? 'danger' :
                    activeDeal.state === 'PENDING_FINANCE' ? 'warning' : 'neutral'
                  }
                  size="md"
                >
                  STATE: {activeDeal.state}
                </Badge>
                <span className="text-xs font-mono text-slate-400">
                  Deal #{activeDeal.dealNumber} · Odoo #{activeDeal.odooOrderId} · v{activeDeal.version}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {activeDeal.title}
              </p>
              <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-500 font-medium">
                <span>Payment Terms: <strong className="text-slate-700">{activeDeal.paymentTerms}</strong></span>
                <span>·</span>
                <span>Historical Spend: <strong className="text-slate-700 font-mono">₹{activeDeal.historicalSpend.toLocaleString('en-IN')}</strong></span>
                <span>·</span>
                <span>Customer Tier Cap: <strong className="text-brand-700 font-mono">{tierMaxDiscount}.0%</strong></span>
                <span>·</span>
                <span>Owner: <strong className="text-slate-700">{activeDeal.salesRepName}</strong></span>
              </div>
            </div>
          </div>

          {/* Deal Actions */}
          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
            <Button variant="secondary" size="sm" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              onClick={handleSendToCustomer}
            >
              Customer Portal
            </Button>
            {activeDeal.state !== 'APPROVED' && activeDeal.state !== 'CONFIRMED' && (
              <Button
                variant={evaluation.severity === 'HIGH' || evaluation.severity === 'CRITICAL' ? 'danger' : 'primary'}
                size="sm"
                disabled={evaluation.tierCeilingBreached}
                icon={<FileCheck className="w-3.5 h-3.5" />}
                onClick={() => submitForApproval(activeDeal.id, evaluation.requiredApprovalRole === 'FINANCE_DIRECTOR' ? 'FINANCE_DIRECTOR' : 'SALES_MANAGER')}
              >
                {evaluation.tierCeilingBreached ? 'Ceiling Breached' : 'Submit Approval'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Cockpit Split View: 8 cols Quote Lines, 4 cols Deal Guardian */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quote Lines & Summary */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quote Lines Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Quotation Lines
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live pricing with instant policy compliance and gross margin calculations
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setProductPickerOpen(true)}
              >
                Add Product
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Item &amp; Category</th>
                    <th className="py-3 px-3 text-center">Qty</th>
                    <th className="py-3 px-3 text-right">Unit Price</th>
                    <th className="py-3 px-4 w-52">Discount (%)</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeDeal.lines.map((line) => {
                    const ceiling = getEffectiveCeiling(activeDeal.customerTier, line.category);
                    const isOverCeiling = line.discountPercent > ceiling + 0.01;
                    const lineGross = line.unitPrice * line.quantity;
                    const discountAmt = lineGross * (line.discountPercent / 100);
                    const lineNet = lineGross - discountAmt;
                    const lineCost = line.costPrice * line.quantity;
                    const lineMargin = lineNet > 0 ? ((lineNet - lineCost) / lineNet) * 100 : 0;

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{line.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="neutral" size="sm">
                              {line.category}
                            </Badge>
                            {line.isSubscription && (
                              <span className="text-[10px] text-brand-600 font-medium font-mono">
                                Recurring ({line.billingPeriod})
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 font-mono">
                              Margin: {lineMargin.toFixed(0)}%
                            </span>
                          </div>
                        </td>

                        {/* Quantity Stepper */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center justify-center border border-slate-200 rounded-md overflow-hidden w-20 mx-auto">
                            <button
                              onClick={() => updateLineQuantity(activeDeal.id, line.id, line.quantity - 1)}
                              disabled={line.quantity <= 1}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="px-2 py-1 font-mono font-bold text-slate-800 text-xs">
                              {line.quantity}
                            </span>
                            <button
                              onClick={() => updateLineQuantity(activeDeal.id, line.id, line.quantity + 1)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Unit Price */}
                        <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-800 tabular-nums">
                          ₹{line.unitPrice.toLocaleString('en-IN')}
                        </td>

                        {/* Interactive Discount Slider & Input */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="range"
                                min="0"
                                max="35"
                                step="1"
                                value={line.discountPercent}
                                onChange={(e) => updateLineDiscount(activeDeal.id, line.id, Number(e.target.value))}
                                className="w-full accent-slate-900 h-1 bg-slate-200 rounded-lg cursor-pointer"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={line.discountPercent}
                                  onChange={(e) => updateLineDiscount(activeDeal.id, line.id, Number(e.target.value))}
                                  className={`w-14 px-1.5 py-0.5 text-right font-mono font-bold text-xs rounded border ${
                                    isOverCeiling
                                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                                      : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                />
                                <span className="text-slate-400 text-[11px]">%</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500">
                                Limit: <strong>{ceiling.toFixed(0)}%</strong> · Cap: <strong className="text-brand-700">{Math.max(0, ceiling - line.discountPercent).toFixed(1)}% left</strong>
                              </span>
                              {isOverCeiling ? (
                                <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                  <AlertCircle className="w-3 h-3" />
                                  +{(line.discountPercent - ceiling).toFixed(0)}% breach
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-medium">Within Tier</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Subtotal */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                            ₹{Math.round(lineNet).toLocaleString('en-IN')}
                          </div>
                          {line.discountPercent > 0 && (
                            <div className="text-[10px] text-slate-400 line-through font-mono">
                              ₹{lineGross.toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>

                        {/* Delete Line */}
                        <td className="py-3.5 px-2 text-right">
                          <button
                            onClick={() => removeLineItem(activeDeal.id, line.id)}
                            className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                            title="Remove Line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Commercial Summary Footer Bar */}
            <div className="bg-slate-50/90 border-t border-slate-200 p-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">List Subtotal</span>
                  <span className="font-mono text-base font-bold text-slate-700 tabular-nums">
                    ₹{evaluation.subtotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">Total Concession</span>
                  <span className="font-mono text-base font-bold text-rose-600 tabular-nums">
                    -₹{evaluation.discountTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">Gross Margin %</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-lg font-extrabold tabular-nums ${
                      evaluation.marginPercent >= 25 ? 'text-emerald-700' :
                      evaluation.marginPercent >= 18 ? 'text-amber-700' : 'text-rose-700'
                    }`}>
                      {evaluation.marginPercent.toFixed(1)}%
                    </span>
                    <Badge variant={evaluation.marginPercent >= 20 ? 'success' : 'danger'} size="sm">
                      {evaluation.marginPercent >= 20 ? 'Target OK' : 'Below 20%'}
                    </Badge>
                  </div>
                </div>
                <div className="text-left md:text-right">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">Net Payable Amount</span>
                  <span className="font-mono text-xl font-black text-slate-900 tabular-nums">
                    ₹{evaluation.netTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Accretive Recommendations Panel ("Next Best Upsell") */}
          <div className="bg-gradient-to-br from-brand-50/50 to-slate-50 rounded-xl border border-brand-200/80 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-brand-600 text-white shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Accretive Margin Recommendations
                  </h3>
                  <p className="text-xs text-slate-600">
                    High-affinity add-ons to offset discount concessions and improve gross margin
                  </p>
                </div>
              </div>
              <Badge variant="purple" size="sm">
                Deterministic Cross-Sell
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {recommendations.slice(0, 2).map((rec) => (
                <div
                  key={rec.id}
                  className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{rec.productName}</h4>
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80 shrink-0">
                        +₹{rec.projectedMarginAmount.toLocaleString('en-IN')} Margin
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5">
                      {rec.rationale}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-700 font-semibold">
                      Qty: {rec.recommendedQty} × ₹{rec.unitPrice.toLocaleString('en-IN')}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Plus className="w-3 h-3" />}
                      onClick={() => addLineFromRecommendation(activeDeal.id, rec)}
                    >
                      Add to Quote
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Persistent Deal Guardian Cockpit Card */}
        <div className="lg:col-span-4 space-y-6">
          <DealGuardianCard />
        </div>
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        title="Add Product from Odoo Master Catalog"
        subtitle="Catalog items with standard enterprise list pricing"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {CATALOG_PRODUCTS.map((prod) => (
            <div
              key={prod.id}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{prod.name}</span>
                  <Badge variant="neutral" size="sm">{prod.category}</Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{prod.description}</p>
                <div className="text-xs font-mono font-semibold text-slate-700 mt-1">
                  List Price: ₹{prod.unitPrice.toLocaleString('en-IN')}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  addProductToDeal(activeDeal.id, prod.id);
                  setProductPickerOpen(false);
                }}
              >
                Select
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

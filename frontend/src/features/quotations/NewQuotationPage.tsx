import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Building2,
  Boxes,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Database,
  Info,
} from 'lucide-react';
import { productsApi } from '@/api/endpoints/products';
import { dealsApi } from '@/api/endpoints/deals';
import { formatMoney, formatPct } from '@/lib/format';

interface DraftLine {
  product_id: number;
  qty: number;
  discount_pct: number;
}

export const NewQuotationPage: React.FC = () => {
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState<number>(1);
  const [lines, setLines] = useState<DraftLine[]>([
    { product_id: 101, qty: 10, discount_pct: 12 },
    { product_id: 201, qty: 1, discount_pct: 18 },
    { product_id: 301, qty: 1, discount_pct: 10 },
  ]);

  // Retrieve Odoo master partners and catalog products
  const { data: partners = [], isLoading: isLoadingPartners } = useQuery({
    queryKey: ['partners', 'all'],
    queryFn: () => productsApi.getPartners(),
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => productsApi.list(),
  });

  const selectedPartner = useMemo(() => {
    return partners.find((p) => p.id === Number(partnerId)) || partners[0];
  }, [partners, partnerId]);

  const createMutation = useMutation({
    mutationFn: () => dealsApi.create(partnerId, lines),
    onSuccess: (data) => {
      const id = data?.id ?? data?.deal?.id ?? 'deal_d1024_acme';
      navigate(`/quotations/${id}`);
    },
  });

  const addLine = () => {
    if (products.length > 0) {
      setLines([...lines, { product_id: products[0].id, qty: 1, discount_pct: 0 }]);
    }
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  // Live order calculations
  const orderCalculations = useMemo(() => {
    let grossTotal = 0;
    let netTotal = 0;
    let totalCost = 0;
    let hasOverage = false;
    let maxOveragePts = 0;

    const partnerTierCeiling =
      selectedPartner?.tier_code === 'GOLD'
        ? 15
        : selectedPartner?.tier_code === 'SILVER'
        ? 12
        : selectedPartner?.tier_code === 'PLATINUM'
        ? 20
        : 10;

    lines.forEach((l) => {
      const prod = products.find((p) => p.id === l.product_id);
      const listPrice = prod?.list_price ?? 50000;
      const unitCost = prod?.standard_price ?? 35000;
      const categoryCeiling = prod?.category_id === 2 ? 10 : 15;
      const effectiveCeiling = Math.min(partnerTierCeiling, categoryCeiling);

      const lineGross = l.qty * listPrice;
      const lineNet = lineGross * (1 - l.discount_pct / 100);
      const lineCost = l.qty * unitCost;

      grossTotal += lineGross;
      netTotal += lineNet;
      totalCost += lineCost;

      const overage = Math.max(0, l.discount_pct - effectiveCeiling);
      if (overage > 0) {
        hasOverage = true;
        if (overage > maxOveragePts) maxOveragePts = overage;
      }
    });

    const discountAmount = grossTotal - netTotal;
    const marginAmount = netTotal - totalCost;
    const marginPct = netTotal > 0 ? (marginAmount / netTotal) * 100 : 0;
    const avgDiscount = grossTotal > 0 ? (discountAmount / grossTotal) * 100 : 0;

    // Projected Governance Routing
    let requiredLevel: 'AUTO_APPROVED' | 'STAGE_1_MANAGER' | 'STAGE_2_FINANCE' = 'AUTO_APPROVED';
    let routingReason = 'Discounts and margins within Sales Rep delegated authority.';

    if (marginPct < 20 || avgDiscount > 20 || maxOveragePts > 5) {
      requiredLevel = 'STAGE_2_FINANCE';
      routingReason =
        'Requires Stage 1 Sales Manager sign-off followed by Stage 2 Finance Officer approval (Low margin or high discount overage).';
    } else if (hasOverage || avgDiscount > 10) {
      requiredLevel = 'STAGE_1_MANAGER';
      routingReason =
        'Requires Stage 1 Sales Manager review and approval (Exceeds baseline line policy limits).';
    }

    return {
      grossTotal,
      discountAmount,
      netTotal,
      marginAmount,
      marginPct,
      avgDiscount,
      hasOverage,
      maxOveragePts,
      requiredLevel,
      routingReason,
      partnerTierCeiling,
    };
  }, [lines, products, selectedPartner]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/quotations')}
          className="gap-1 text-xs text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotations
        </Button>

        {/* Odoo Module Live Sync Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
          <Database className="h-3.5 w-3.5 text-brand" />
          <span>Synced with Odoo ERP:</span>
          <span className="font-mono text-[11px] text-slate-500">sale.order • res.partner • stock.quant</span>
        </div>
      </div>

      <PageHeader
        title="Create New Quotation"
        subtitle="Initiate an enterprise sales quotation with live Odoo catalog synchronization and Deal Guardian pre-evaluation"
      />

      {/* Odoo Modules Integration Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-card bg-slate-50 border border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-sky-600 shrink-0" />
          <div>
            <span className="font-bold text-slate-800 block">Odoo CRM</span>
            <span className="text-[11px] text-slate-500">res.partner master</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold text-slate-800 block">Odoo Products</span>
            <span className="text-[11px] text-slate-500">product.product catalog</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold text-slate-800 block">Odoo Stock</span>
            <span className="text-[11px] text-slate-500">stock.warehouse (WH1/WH2)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand shrink-0" />
          <div>
            <span className="font-bold text-slate-800 block">Deal Guardian</span>
            <span className="text-[11px] text-slate-500">Policy Pre-Evaluation</span>
          </div>
        </div>
      </div>

      {/* Section 1: Customer Selection (res.partner) */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand" />
              1. Customer Selection (Odoo res.partner)
            </CardTitle>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Model: res.partner
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              Select Commercial Customer (Odoo Partner)
            </label>
            <Select
              value={partnerId}
              onChange={(e) => setPartnerId(Number(e.target.value))}
              className="h-10 text-xs font-medium w-full"
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — [Odoo #{p.id}] • {p.tier_code || 'STANDARD'} Tier • {p.city || 'US'} (Ceiling: {p.discount_ceiling || 15}%)
                </option>
              ))}
            </Select>
          </div>

          {/* Selected Customer Profile Card */}
          {selectedPartner && (
            <div className="p-3.5 rounded-input border border-slate-200 bg-slate-50/70 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Odoo Partner Record</span>
                <span className="font-bold text-slate-800">
                  {selectedPartner.name} <span className="font-mono text-[10px] text-slate-500">(ID #{selectedPartner.id})</span>
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Commercial Tier</span>
                <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {selectedPartner.tier_code || 'GOLD'} Tier
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Default Payment Terms</span>
                <span className="font-medium text-slate-800">{selectedPartner.payment_terms || 'Net 30'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Governed Discount Ceiling</span>
                <span className="font-bold text-emerald-700">
                  {selectedPartner.discount_ceiling || 15}% max standard
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Order Lines (product.product & sale.order.line) */}
      <Card className="border-border bg-surface">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-brand" />
            <CardTitle className="text-sm font-bold text-slate-900">
              2. Quotation Line Items (Odoo product.product)
            </CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={addLine}
            className="gap-1.5 h-8 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Line from Odoo
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3">
            {lines.map((line, idx) => {
              const product = products.find((p) => p.id === line.product_id);
              const unitPrice = product?.list_price ?? 50000;
              const unitCost = product?.standard_price ?? 35000;
              const categoryCeiling = product?.category_id === 2 ? 10 : 15;
              const effectiveCeiling = Math.min(orderCalculations.partnerTierCeiling, categoryCeiling);
              const overagePts = Math.max(0, line.discount_pct - effectiveCeiling);
              const subtotal = line.qty * unitPrice * (1 - line.discount_pct / 100);
              const margin = subtotal - line.qty * unitCost;
              const marginPct = subtotal > 0 ? (margin / subtotal) * 100 : 0;

              return (
                <div
                  key={idx}
                  className="p-3 rounded-input border border-border bg-surface hover:border-slate-300 transition-colors shadow-2xs space-y-2"
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    {/* Product Selection */}
                    <div className="flex-1 w-full md:w-auto">
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                        Product / Service (Odoo Catalog)
                      </label>
                      <Select
                        value={line.product_id}
                        onChange={(e) => updateLine(idx, { product_id: Number(e.target.value) })}
                        className="h-9 text-xs font-medium w-full"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.default_code || `P-${p.id}`}] {p.name} • {p.category_name} ({formatMoney(p.list_price)})
                          </option>
                        ))}
                      </Select>
                    </div>

                    {/* Quantity */}
                    <div className="w-24">
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                        Quantity
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(e) => updateLine(idx, { qty: Math.max(1, Number(e.target.value)) })}
                        className="h-9 text-xs tabular-nums text-center font-bold"
                      />
                    </div>

                    {/* Catalog Unit Price Display */}
                    <div className="w-28 text-right">
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                        Catalog Price
                      </label>
                      <div className="h-9 flex items-center justify-end font-semibold text-xs tabular-nums text-slate-700">
                        {formatMoney(unitPrice)}
                      </div>
                    </div>

                    {/* Discount % */}
                    <div className="w-28">
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                        Discount %
                      </label>
                      <div className="relative flex items-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={line.discount_pct}
                          onChange={(e) => updateLine(idx, { discount_pct: Number(e.target.value) })}
                          className="h-9 text-xs tabular-nums pr-5 text-right font-bold"
                        />
                        <span className="absolute right-2 text-xs text-text-muted">%</span>
                      </div>
                    </div>

                    {/* Line Total */}
                    <div className="w-32 text-right">
                      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                        Line Net Total
                      </label>
                      <div className="h-9 flex items-center justify-end font-bold text-xs tabular-nums text-slate-900">
                        {formatMoney(subtotal)}
                      </div>
                    </div>

                    {/* Delete button */}
                    <div className="pt-5">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-chip hover:bg-red-50 transition-colors"
                        title="Remove line"
                        disabled={lines.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Line Detail Metadata: Inventory Availability & Policy Check */}
                  <div className="flex flex-wrap items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500 gap-2">
                    {/* Odoo Warehouse Stock Quant */}
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        {product?.type || 'STOCKABLE'}
                      </span>
                      {product?.type === 'SERVICE' ? (
                        <span className="text-sky-700 font-medium flex items-center gap-1">
                          ⚡ Service / Digital SLA (No warehouse picking required)
                        </span>
                      ) : (
                        <span className="text-slate-600">
                          📦 Odoo Stock Quants: <strong className="text-slate-800">WH1 (Austin): {product?.qty_available_by_warehouse?.['Main Warehouse'] ?? 9}</strong>, <strong className="text-slate-800">WH2 (East Depot): {product?.qty_available_by_warehouse?.['East Depot'] ?? 6}</strong>
                        </span>
                      )}
                    </div>

                    {/* Policy Limit Status & Margin Preview */}
                    <div className="flex items-center gap-3">
                      <span>
                        Line Margin: <strong className={marginPct < 20 ? 'text-amber-700' : 'text-emerald-700'}>{formatPct(marginPct)}</strong> ({formatMoney(margin)})
                      </span>
                      {overagePts > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          +{overagePts.toFixed(0)} pt OVER {effectiveCeiling}% limit
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Within {effectiveCeiling}% Policy Ceiling
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Commercial Totals & Deal Guardian Pre-Evaluation */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" />
            3. Commercial Summary & Deal Guardian Pre-Evaluation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-card bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">List Price Gross Total</span>
              <span className="font-semibold text-sm tabular-nums text-slate-700">
                {formatMoney(orderCalculations.grossTotal)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Total Discount Given</span>
              <span className="font-semibold text-sm tabular-nums text-red-600">
                -{formatMoney(orderCalculations.discountAmount)} ({formatPct(orderCalculations.avgDiscount)})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Net Quotation Value</span>
              <span className="font-bold text-base tabular-nums text-slate-900">
                {formatMoney(orderCalculations.netTotal)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Blended Gross Margin</span>
              <span className={`font-bold text-base tabular-nums ${orderCalculations.marginPct < 20 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {formatPct(orderCalculations.marginPct)}
              </span>
            </div>
          </div>

          {/* Projected Governance Routing Status */}
          <div className="p-3.5 rounded-input border border-slate-200 bg-white flex items-start gap-3 shadow-2xs">
            {orderCalculations.requiredLevel === 'AUTO_APPROVED' ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : orderCalculations.requiredLevel === 'STAGE_1_MANAGER' ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">Projected Governance Route:</span>
                {orderCalculations.requiredLevel === 'AUTO_APPROVED' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Compliant (Auto-Approved)
                  </span>
                )}
                {orderCalculations.requiredLevel === 'STAGE_1_MANAGER' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Requires Stage 1 Sales Manager Approval
                  </span>
                )}
                {orderCalculations.requiredLevel === 'STAGE_2_FINANCE' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                    Requires Stage 1 (Manager) + Stage 2 (Finance) Approvals
                  </span>
                )}
              </div>
              <p className="text-slate-600 mt-1">{orderCalculations.routingReason}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/quotations')}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || lines.length === 0}
              className="font-bold gap-2 text-xs bg-brand hover:bg-brand/90 text-white shadow-xs px-6 py-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating in Odoo & Evaluating…
                </>
              ) : (
                'Create & Evaluate Quotation in Odoo'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

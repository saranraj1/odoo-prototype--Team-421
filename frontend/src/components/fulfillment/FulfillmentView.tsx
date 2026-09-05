import React, { useState } from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { Badge, Button, Card } from '../ui';
import { Truck, CheckCircle2, AlertTriangle, Building, MapPin, Box, ShieldCheck } from 'lucide-react';

export const FulfillmentView: React.FC = () => {
  const { activeDeal, fulfillmentPlan, acceptFulfillmentPlan } = useDealFlow();
  const [manualMode, setManualMode] = useState(false);
  const [acceptedToast, setAcceptedToast] = useState(false);

  // Local state for manual override quantities
  const [allocations, setAllocations] = useState<Record<string, { main: number; east: number }>>(() => {
    const map: Record<string, { main: number; east: number }> = {};
    for (const line of fulfillmentPlan.lines) {
      map[line.productId] = {
        main: line.allocatedFromMain,
        east: line.allocatedFromEast,
      };
    }
    return map;
  });

  const handleAdjust = (productId: string, wh: 'main' | 'east', delta: number, maxRequested: number) => {
    setAllocations((prev) => {
      const current = prev[productId] || { main: 0, east: 0 };
      const newMain = wh === 'main' ? Math.max(0, current.main + delta) : current.main;
      const newEast = wh === 'east' ? Math.max(0, current.east + delta) : current.east;

      return {
        ...prev,
        [productId]: { main: newMain, east: newEast },
      };
    });
  };

  const handleAccept = () => {
    acceptFulfillmentPlan(activeDeal.id);
    setAcceptedToast(true);
    setTimeout(() => setAcceptedToast(false), 2500);
  };

  const isSplit = fulfillmentPlan.status === 'SPLIT_REQUIRED';

  return (
    <div className="space-y-6">
      {acceptedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-lg shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Fulfillment split locked and delivery pickings created in Odoo (stock.picking)</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-600" />
            Multi-Warehouse Fulfillment Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Optimized stock routing across regional depots with greedy allocation and quantity conservation guarantees
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={manualMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setManualMode(!manualMode)}
          >
            {manualMode ? 'Lock Manual Override' : 'Manual Override'}
          </Button>
          <Button variant="success" size="sm" onClick={handleAccept}>
            Accept &amp; Commit Plan
          </Button>
        </div>
      </div>

      {/* Plan Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Fulfillment Strategy</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-base font-bold text-slate-900">
              {isSplit ? 'Multi-Facility Split' : 'Single Warehouse Direct'}
            </span>
            <Badge variant={isSplit ? 'warning' : 'success'}>
              {fulfillmentPlan.status}
            </Badge>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Greedy primary warehouse allocation first
          </span>
        </Card>

        <Card className="p-4 border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Consignments</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {fulfillmentPlan.shipmentCount} Shipments
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Main Central + East Regional Depot
          </span>
        </Card>

        <Card className="p-4 border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Estimated Freight Cost</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            ₹{fulfillmentPlan.estimatedShippingCost.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Standard surface courier express
          </span>
        </Card>
      </div>

      {/* Warehouse Allocation Cards */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Allocated Order Deliverables
        </h3>

        {fulfillmentPlan.lines.map((line) => {
          const alloc = allocations[line.productId] || {
            main: line.allocatedFromMain,
            east: line.allocatedFromEast,
          };

          const allocatedTotal = alloc.main + alloc.east;
          const backorder = Math.max(0, line.requestedQty - allocatedTotal);
          const isConservationSatisfied = allocatedTotal + backorder === line.requestedQty;

          return (
            <Card key={line.productId} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{line.productName}</span>
                    <Badge variant="neutral" size="sm">Requested: {line.requestedQty}</Badge>
                  </div>
                  <span className="text-xs text-slate-500 mt-0.5 block font-mono">
                    Product Code: {line.productId}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {isConservationSatisfied ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Conservation Satisfied ({allocatedTotal}/{line.requestedQty})
                    </span>
                  ) : (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Quantity Discrepancy!
                    </span>
                  )}
                </div>
              </div>

              {/* Warehouse Breakdown Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Main Warehouse */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Building className="w-4 h-4 text-slate-500" />
                      <span>Main Central (BOM-WH-01)</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {alloc.main} / {line.requestedQty}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 transition-all duration-300"
                      style={{ width: `${Math.min(100, (alloc.main / line.requestedQty) * 100)}%` }}
                    ></div>
                  </div>

                  {manualMode && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-500">Adjust Allocation:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAdjust(line.productId, 'main', -1, line.requestedQty)}
                          disabled={alloc.main <= 0}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold w-6 text-center">{alloc.main}</span>
                        <button
                          onClick={() => handleAdjust(line.productId, 'main', 1, line.requestedQty)}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* East Depot */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <span>East Regional Depot (CCU-DP-02)</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {alloc.east} / {line.requestedQty}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, (alloc.east / line.requestedQty) * 100)}%` }}
                    ></div>
                  </div>

                  {manualMode && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-500">Adjust Allocation:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAdjust(line.productId, 'east', -1, line.requestedQty)}
                          disabled={alloc.east <= 0}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold w-6 text-center">{alloc.east}</span>
                        <button
                          onClick={() => handleAdjust(line.productId, 'east', 1, line.requestedQty)}
                          className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {backorder > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Remaining <strong>{backorder} units</strong> will be scheduled as a delayed backorder fulfillment consignment.
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

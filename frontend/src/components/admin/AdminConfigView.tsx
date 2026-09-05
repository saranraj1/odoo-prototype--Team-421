import React from 'react';
import { CUSTOMER_TIER_CAPS, CATEGORY_CEILINGS } from '../../data/policies';
import { WAREHOUSES } from '../../data/warehouses';
import { Card, Badge } from '../ui';
import { Settings, Shield, Building, Users } from 'lucide-react';

export const AdminConfigView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-600" />
          DealFlow360 System Configuration
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Deterministic governance parameters, customer tier caps, and regional warehouse routing rules
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Tier Ceilings */}
        <Card className="p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield className="w-4 h-4 text-brand-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Customer Tier Discount Caps
            </h3>
          </div>

          <div className="divide-y divide-slate-100 mt-2 text-xs">
            {Object.entries(CUSTOMER_TIER_CAPS).map(([tier, cap]) => (
              <div key={tier} className="py-2.5 flex items-center justify-between">
                <span className="font-semibold text-slate-800">{tier} TIER</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  Max {cap.toFixed(1)}% Discount
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Product Category Ceilings */}
        <Card className="p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield className="w-4 h-4 text-brand-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Product Category Discount Ceilings
            </h3>
          </div>

          <div className="divide-y divide-slate-100 mt-2 text-xs">
            {Object.entries(CATEGORY_CEILINGS).map(([category, ceiling]) => (
              <div key={category} className="py-2.5 flex items-center justify-between">
                <span className="font-semibold text-slate-800">{category}</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  Ceiling {ceiling.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Regional Warehouses */}
        <Card className="p-5 md:col-span-2">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-4 h-4 text-brand-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Configured Regional Stock Facilities (Odoo stock.warehouse)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs">
            {WAREHOUSES.map((wh) => (
              <div key={wh.warehouseId} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block">{wh.warehouseName}</span>
                <span className="text-[11px] font-mono text-slate-500 block mt-0.5">Code: {wh.locationCode}</span>
                <div className="mt-2 text-slate-600">
                  Available Developer Laptops: <strong className="font-mono text-slate-900">{wh.availableQty['prod-laptop']} units</strong>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

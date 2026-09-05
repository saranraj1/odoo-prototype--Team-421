import React, { useState } from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { useRole } from '../../app/providers/RoleContext';
import { CustomerTier } from '../../types';
import { Badge, Button, Card } from '../ui';
import { ShieldCheck, Users, Save, CheckCircle2, AlertTriangle, Building2, TrendingUp } from 'lucide-react';

export const CustomerClassificationView: React.FC = () => {
  const { customers, updateCustomerClassification } = useDealFlow();
  const { currentUser } = useRole();

  const [selectedTiers, setSelectedTiers] = useState<Record<string, CustomerTier>>(() => {
    const map: Record<string, CustomerTier> = {};
    for (const c of customers) {
      map[c.id] = c.tier;
    }
    return map;
  });

  const [savedToast, setSavedToast] = useState<string | null>(null);

  const handleTierChange = (customerId: string, newTier: CustomerTier) => {
    setSelectedTiers((prev) => ({ ...prev, [customerId]: newTier }));
  };

  const handleSaveTier = (customerId: string) => {
    const newTier = selectedTiers[customerId];
    if (!newTier) return;

    const managerName = currentUser?.name || 'Sunita Nair';
    updateCustomerClassification(customerId, newTier, managerName);

    const customer = customers.find((c) => c.id === customerId);
    setSavedToast(`${customer?.name || 'Customer'} successfully classified as ${newTier} Tier (Max ${newTier === 'GOLD' ? '15%' : newTier === 'SILVER' ? '10%' : '5%'} discount).`);
    setTimeout(() => setSavedToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-lg shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            Customer Tier Classification &amp; Governance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Exclusive Sales Manager authority to assign Gold, Silver, and Bronze commercial discount ceilings
          </p>
        </div>

        <Badge variant="purple" size="md">
          Sales Manager Exclusive Authority
        </Badge>
      </div>

      {/* Doctrine Rule Banner */}
      <div className="p-4 rounded-xl bg-brand-50/70 border border-brand-200 text-brand-950 text-xs flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Fixed Business Rule: Customer Tier Controls Commercial Ceiling</span>
          <span className="text-brand-800">
            A customer must NEVER receive a discount above their assigned tier ceiling:
            <strong> Gold: 15.0% Max</strong> · <strong>Silver: 10.0% Max</strong> · <strong>Bronze: 5.0% Max</strong>.
            Reps and customers cannot alter these tiers.
          </span>
        </div>
      </div>

      {/* Customer Classification Cards */}
      <div className="space-y-4">
        {customers.map((cust) => {
          const currentChosenTier = selectedTiers[cust.id] || cust.tier;
          const isDirty = currentChosenTier !== cust.tier;

          const maxAllowed = currentChosenTier === 'GOLD' ? 15.0 : currentChosenTier === 'SILVER' ? 10.0 : 5.0;

          return (
            <Card key={cust.id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-slate-100 rounded-lg text-slate-700 shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-base text-slate-900">{cust.name}</h3>
                      <Badge
                        variant={cust.tier === 'GOLD' ? 'warning' : cust.tier === 'SILVER' ? 'info' : 'neutral'}
                        size="sm"
                      >
                        CURRENT: {cust.tier} TIER
                      </Badge>
                      <span className="text-xs font-mono text-slate-400">{cust.code}</span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      Payment Terms: <strong className="text-slate-700">{cust.paymentTerms}</strong> · Historical Spend: <strong className="font-mono text-slate-800">₹{cust.historicalSpend.toLocaleString('en-IN')}</strong> · Assigned Rep: <strong className="text-slate-700">{cust.assignedRepName}</strong>
                    </p>

                    <div className="text-[11px] text-slate-400 mt-1">
                      Last classified by {cust.classifiedBy} on {new Date(cust.classifiedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Tier Selection Controls */}
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
                  <div className="text-right">
                    <label className="text-[11px] font-bold text-slate-500 uppercase block">
                      Assign Customer Tier
                    </label>
                    <span className="font-mono text-xs font-bold text-brand-700">
                      Max Discount: {maxAllowed.toFixed(0)}%
                    </span>
                  </div>

                  <select
                    value={currentChosenTier}
                    onChange={(e) => handleTierChange(cust.id, e.target.value as CustomerTier)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none cursor-pointer"
                  >
                    <option value="GOLD">🥇 GOLD TIER (15% Max)</option>
                    <option value="SILVER">🥈 SILVER TIER (10% Max)</option>
                    <option value="BRONZE">🥉 BRONZE TIER (5% Max)</option>
                  </select>

                  <Button
                    variant={isDirty ? 'primary' : 'secondary'}
                    size="sm"
                    icon={<Save className="w-3.5 h-3.5" />}
                    onClick={() => handleSaveTier(cust.id)}
                  >
                    {isDirty ? 'Save Tier' : 'Saved'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

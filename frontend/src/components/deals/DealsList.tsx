import React, { useState } from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { Badge, Button, Card } from '../ui';
import { Layers, Search, Filter, ArrowRight, ExternalLink } from 'lucide-react';

interface DealsListProps {
  onSelectDeal: (dealId: string) => void;
}

export const DealsList: React.FC<DealsListProps> = ({ onSelectDeal }) => {
  const { deals, allEvaluations, setActiveDealId } = useDealFlow();
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  const filteredDeals = deals.filter((d) => {
    const matchesSearch =
      d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.dealNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.odooOrderId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'ALL' || d.customerTier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600" />
            Quotations &amp; Commercial Orders
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete list of active quotations with upfront risk scores, margin calculations, and ERP state
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer, deal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 w-48 sm:w-64"
            />
          </div>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none text-slate-700 font-medium"
          >
            <option value="ALL">All Tiers</option>
            <option value="PLATINUM">Platinum</option>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="STANDARD">Standard</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Customer &amp; Deal</th>
                <th className="py-3 px-3">Tier</th>
                <th className="py-3 px-3 text-right">Net Amount</th>
                <th className="py-3 px-3 text-right">Margin %</th>
                <th className="py-3 px-3 text-center">Risk Score</th>
                <th className="py-3 px-3">Stage / State</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeals.map((deal) => {
                const ev = allEvaluations[deal.id];
                const isHighRisk = (ev?.blendedRiskScore ?? 0) >= 60;
                const isMedRisk = (ev?.blendedRiskScore ?? 0) >= 30 && (ev?.blendedRiskScore ?? 0) < 60;

                return (
                  <tr
                    key={deal.id}
                    onClick={() => {
                      setActiveDealId(deal.id);
                      onSelectDeal(deal.id);
                    }}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{deal.customerName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {deal.dealNumber} · Odoo #{deal.odooOrderId}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <Badge variant="info" size="sm">
                        {deal.customerTier}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      ₹{Math.round(ev?.netTotal || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-slate-700 tabular-nums">
                      {ev?.marginPercent.toFixed(1)}%
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <Badge
                        variant={isHighRisk ? 'danger' : isMedRisk ? 'warning' : 'success'}
                        size="md"
                        className="font-mono font-bold"
                      >
                        Risk {ev?.blendedRiskScore}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-3">
                      <Badge
                        variant={
                          deal.state === 'APPROVED' ? 'success' :
                          deal.state === 'INVALIDATED' ? 'danger' :
                          deal.state === 'PENDING_FINANCE' ? 'warning' : 'neutral'
                        }
                        size="sm"
                      >
                        {deal.state}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<ExternalLink className="w-3.5 h-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDealId(deal.id);
                          onSelectDeal(deal.id);
                        }}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

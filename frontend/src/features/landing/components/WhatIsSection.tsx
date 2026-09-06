import React from 'react';
import { ShieldCheck, AlertOctagon, TrendingDown, Clock, Layers, RefreshCw, CheckCircle2 } from 'lucide-react';

export const WhatIsSection: React.FC = () => {
  const painPoints = [
    {
      title: 'Margin Erosion from Rogue Discounting',
      desc: 'Sales representatives frequently grant steep discounts to hit short-term volume targets without knowing product cost baselines or tier limits, eroding business profitability.',
      impact: 'Up to 8–15% gross margin lost per deal',
    },
    {
      title: 'Slow Approvals & Broken Sign-off Chains',
      desc: 'High-value quotations get stuck in multi-day email loops waiting for approvals, or slip into customer hands without mandatory executive review.',
      impact: 'Deal velocity delayed by days; compliance blind spots',
    },
    {
      title: 'The Counteroffer Trap (Negotiation Drift)',
      desc: 'A quote receives finance sign-off for an 18% discount. The customer counters with 22%. In typical setups, the rep accepts without re-approval because the quote was already marked approved.',
      impact: 'Prior approvals compromised; hidden margin destruction',
    },
    {
      title: 'Quoting Without Inventory Reality',
      desc: 'Sales promises delivery dates without checking stock distribution across regional warehouses, resulting in unexpected split shipments, freight costs, and backorders.',
      impact: 'Unexpected shipping costs and delayed deliveries',
    },
    {
      title: 'Stalled Pipeline Inactivity',
      desc: 'Deals linger in negotiation stages without follow-ups. Managers only discover stalled or high-risk deals at the end of the quarter when it is too late to recover.',
      impact: 'Lost revenue and inaccurate sales forecasting',
    },
  ];

  return (
    <section id="about" className="py-20 bg-white border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Part 1: What is DealFlow360 */}
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 mb-4">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-700" />
            <span>Overview</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            What is DealFlow360?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            DealFlow360 is an intelligent commercial governance and deal operations platform designed to oversee the entire commercial lifecycle before commitments are finalized. It acts as an automated decision brain that continuously evaluates deal health, enforces pricing discipline, manages approval lifecycles, and coordinates inventory fulfillment.
          </p>
        </div>

        {/* Part 2: Why It Is Required */}
        <div id="why-required" className="mt-20 pt-10 border-t border-slate-100">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 mb-3">
              <AlertOctagon className="h-3.5 w-3.5" />
              <span>The Commercial Challenge</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Why is DealFlow360 Required?
            </h3>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Standard CRM and quotation tools are static records: reps enter numbers, check a box, and send. They fail to govern commercial realities mid-flight, resulting in costly operational failures:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {painPoints.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 font-mono font-bold text-xs text-slate-800">
                      0{idx + 1}
                    </span>
                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                      High Risk
                    </span>
                  </div>
                  <h4 className="mt-3.5 text-sm font-bold text-slate-900 leading-snug">{item.title}</h4>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 text-[11px] font-medium text-slate-500">
                  <strong className="text-slate-700 font-semibold">Cost:</strong> {item.impact}
                </div>
              </div>
            ))}

            {/* Solution Summary Card */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm pb-3 border-b border-emerald-200/60">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>The DealFlow360 Solution</span>
                </div>
                <p className="text-xs text-emerald-900 mt-3.5 leading-relaxed">
                  DealFlow360 continuously governs quotations with reproducible mathematical rules. If terms deteriorate during negotiations, prior approvals are instantly revoked, and orders are safeguarded against premature commitment.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-200/60 text-[11px] font-bold text-emerald-800">
                100% Protected · Auditable Decisions
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

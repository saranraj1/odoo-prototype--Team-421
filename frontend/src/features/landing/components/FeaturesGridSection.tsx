import React from 'react';
import { ShieldAlert, Sliders, CheckCircle2, RefreshCw, Layers, TrendingUp, FileText, AlertTriangle, BarChart3, Lock } from 'lucide-react';

export const FeaturesGridSection: React.FC = () => {
  const features = [
    {
      icon: ShieldAlert,
      title: 'Blended Risk Scoring (0–100)',
      desc: 'Continuously evaluates line discounts, gross margin erosion, multi-warehouse delivery splits, and quote staleness into an explainable 0–100 risk score.',
      tag: 'Risk Analysis',
    },
    {
      icon: Sliders,
      title: 'Automated Discount Policy Enforcement',
      desc: 'Enforces customer tier caps and category ceilings using strict minimum rules, mathematically stopping unauthorized concessions before they reach customers.',
      tag: 'Policy Controls',
    },
    {
      icon: CheckCircle2,
      title: 'Multi-Tier Approval State Machine',
      desc: 'Automates approval routing with strict Segregation of Duties: Sales Reps cannot self-approve, Managers handle standard exceptions, and Finance governs high-risk terms.',
      tag: 'Approval Routing',
    },
    {
      icon: Lock,
      title: 'Counteroffer Drift & Baseline Invalidation',
      desc: 'Freezes approved terms into an immutable baseline. If customer negotiations alter margins or discounts, prior approval is instantly revoked.',
      tag: 'Negotiation Guard',
    },
    {
      icon: Layers,
      title: 'Multi-Warehouse Inventory Allocation',
      desc: 'Greedily allocates inventory from primary and secondary warehouses, flags backorders, and creates split delivery orders while conserving exact order quantities.',
      tag: 'Fulfillment Logic',
    },
    {
      icon: TrendingUp,
      title: 'Margin-Accretive Recommendations',
      desc: 'Calculates high-margin complementary add-ons and accessories based on co-purchase affinity to offset granted discounts without recommending loss leaders.',
      tag: 'Revenue Expansion',
    },
    {
      icon: RefreshCw,
      title: 'Hybrid Billing & Subscription Tracking',
      desc: 'Unifies one-time physical equipment with recurring software and support subscriptions on a single order, accurately tracking MRR and ARR.',
      tag: 'Hybrid Billing',
    },
    {
      icon: AlertTriangle,
      title: 'Deal Health & Anomaly Detection',
      desc: 'Proactively identifies stalled opportunities (inactive for >5 days) and statistical discount outliers, offering one-click Nudge and Escalate actions.',
      tag: 'Anomaly Detection',
    },
    {
      icon: BarChart3,
      title: 'Executive BI & Compliance Reporting',
      desc: 'Provides portfolio-wide visibility into deal risk distributions, approval cycle velocity, discount leakage patterns, and exportable audit datasets.',
      tag: 'Analytics & Audit',
    },
    {
      icon: FileText,
      title: 'Protected Negotiation Experience',
      desc: 'Empowers clients to review proposals and submit line-level counteroffers with zero data leakage: internal costs, margins, and risk scores remain completely hidden.',
      tag: 'Zero-Trust Portal',
    },
  ];

  return (
    <section id="features" className="py-20 bg-slate-50/50 border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-800 mb-4">
            <Sliders className="h-3.5 w-3.5 text-sky-700" />
            <span>Platform Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Comprehensive DealFlow360 Features
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600">
            A complete suite of commercial governance tools designed to give enterprises total command over quoting, margins, approvals, and fulfillment.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700 border border-sky-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                      {feat.tag}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">{feat.title}</h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

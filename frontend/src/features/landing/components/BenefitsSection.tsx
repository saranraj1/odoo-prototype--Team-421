import React from 'react';
import { ShieldCheck, TrendingUp, Zap, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const BenefitsSection: React.FC = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      metric: '8–15%',
      label: 'Margin Recovery',
      desc: 'Reclaims lost profits by mathematically enforcing discount ceilings and preventing unapproved concessions.',
    },
    {
      metric: '< 24 Hours',
      label: 'Approval Velocity',
      desc: 'Cuts approval lag from days to hours with automated, stage-specific routing and instant exception sign-offs.',
    },
    {
      metric: '100%',
      label: 'Negotiation Protection',
      desc: 'Freezes approved commercial terms so counter-proposals can never silently degrade deal profitability.',
    },
    {
      metric: '0',
      label: 'Fulfillment Surprises',
      desc: 'Eliminates delivery date guesswork by planning regional warehouse splits before quotation commitment.',
    },
  ];

  return (
    <section id="benefits" className="py-20 bg-white border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 mb-4">
            <TrendingUp className="h-3.5 w-3.5 text-sky-700" />
            <span>Business Impact</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Key Business Outcomes
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600">
            Measurable results delivered across sales execution, finance oversight, and customer fulfillment.
          </p>
        </div>

        {/* 4 Metric Boxes */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-center shadow-2xs hover:bg-white hover:shadow-xs transition-all"
            >
              <div className="text-3xl sm:text-4xl font-black text-sky-700 font-mono">{b.metric}</div>
              <div className="text-sm font-bold text-slate-900 mt-1">{b.label}</div>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom Banner with Login CTA */}
        <div className="mt-16 max-w-4xl mx-auto rounded-2xl border border-sky-200 bg-sky-50/60 p-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
          <div>
            <h3 className="text-lg font-bold text-sky-950">Ready to Experience DealFlow360?</h3>
            <p className="text-xs text-sky-800 mt-1 max-w-lg">
              Sign in with your user account to access the quotation builder, approval cockpit, and negotiation portal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-6 py-3 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <span>Login to Portal</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

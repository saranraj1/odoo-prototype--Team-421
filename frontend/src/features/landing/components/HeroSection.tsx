import React from 'react';
import { ArrowRight, CheckCircle2, Shield, TrendingUp, Sliders, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 border-b border-slate-200 bg-linear-to-b from-white via-slate-50/50 to-white">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          {/* Category Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-800 mb-6 shadow-2xs">
            <Shield className="h-3.5 w-3.5 text-sky-700" />
            <span>Intelligent Commercial Sales Governance</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            Self-Governing Deal Lifecycle &amp;{' '}
            <span className="text-sky-700">Margin Protection</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed font-normal">
            DealFlow360 gives sales and finance teams real-time deal risk scoring, automated discount policy enforcement, multi-warehouse fulfillment planning, and protected customer negotiations.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <span>Login to Portal</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <span>Explore Features</span>
            </button>
          </div>
        </div>

        {/* 4 Value Highlights Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 mb-3 border border-sky-100">
              <Lock className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Margin Protection</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Stops unapproved discounting and enforces company pricing ceilings before deals are committed.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 mb-3 border border-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Automated Approvals</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Instantly routes quotes exceeding standard limits to managers and finance with clear audit trails.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 mb-3 border border-indigo-100">
              <Sliders className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Real-Time Risk Scoring</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Continuous 0–100 risk scoring evaluating discounts, margins, delivery logistics, and deal staleness.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 mb-3 border border-amber-100">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Accretive Growth</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Recommends high-margin complementary add-ons to restore profitability on discounted deals.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 text-slate-500 text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-700 text-white shadow-xs">
              <Shield className="h-4 w-4 fill-white" />
            </div>
            <span className="font-bold text-sm text-slate-900">
              DealFlow<span className="text-sky-700">360</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] text-slate-500">Commercial Deal Governance Platform</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600">
            <a href="#about" className="hover:text-slate-900 transition-colors">What is DealFlow360</a>
            <a href="#why-required" className="hover:text-slate-900 transition-colors">Why Required</a>
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#benefits" className="hover:text-slate-900 transition-colors">Benefits</a>
            <Link to="/login" className="font-bold text-sky-700 hover:text-sky-800 transition-colors">
              Login to Portal
            </Link>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div>
            &copy; 2026 DealFlow360. All rights reserved.
          </div>
          <div>
            Intelligent Sales Operations &amp; Margin Protection
          </div>
        </div>
      </div>
    </footer>
  );
};

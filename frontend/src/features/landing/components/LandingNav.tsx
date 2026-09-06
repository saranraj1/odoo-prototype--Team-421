import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ArrowRight, LogIn } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';

export const LandingNav: React.FC = () => {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-700 text-white shadow-xs">
            <Shield className="h-5 w-5 fill-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-slate-900 leading-tight">
              DealFlow<span className="text-sky-700 font-extrabold">360</span>
            </span>
            <span className="text-[11px] font-medium text-slate-500 leading-tight">
              Deal Governance Platform
            </span>
          </div>
        </Link>

        {/* Navigation Section Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => scrollToSection('about')}
            className="px-3 py-1.5 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            What is DealFlow360
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('why-required')}
            className="px-3 py-1.5 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Why Required
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('features')}
            className="px-3 py-1.5 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Core Features
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('benefits')}
            className="px-3 py-1.5 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Key Benefits
          </button>
        </nav>

        {/* Single Unified Login Action */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <span>Go to Workspace ({user.name.split(' ')[0]})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAuth();
                  navigate('/');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Login to Portal</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

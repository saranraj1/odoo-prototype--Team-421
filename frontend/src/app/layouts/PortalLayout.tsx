import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut, User } from 'lucide-react';
import { usePortalAuthStore } from '@/features/portal/portalAuthStore';
import { PORTAL_NAV_TABS } from '@/lib/rbac';

export const PortalLayout: React.FC = () => {
  const { partner, clearAuth } = usePortalAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/portal/login');
  };

  return (
    <div className="min-h-screen bg-app flex flex-col">
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-white px-6 text-text-primary shadow-xs select-none backdrop-blur-xs bg-white/95">
        <div className="flex items-center gap-6">
          <div
            onClick={() => navigate('/portal/quotations')}
            className="flex items-center gap-2.5 cursor-pointer font-bold text-base tracking-tight text-slate-900"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="leading-tight">DealFlow<span className="text-emerald-600">Portal</span></span>
              <span className="text-[10px] font-normal text-text-muted leading-tight">Customer Access</span>
            </div>
          </div>

          <nav className="flex items-center space-x-1">
            {PORTAL_NAV_TABS.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {partner && (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-text-primary bg-slate-50 border border-border px-2.5 py-1 rounded-lg">
                <User className="h-3.5 w-3.5 text-text-muted" />
                <span className="font-semibold">{partner.name}</span>
                <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  CUSTOMER
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-danger transition-colors border border-transparent hover:border-rose-200"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-16">
        <Outlet />
      </main>
    </div>
  );
};

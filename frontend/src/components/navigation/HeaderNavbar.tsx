import React, { useState } from 'react';
import { useRole } from '../../app/providers/RoleContext';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { 
  ShieldCheck, 
  RotateCcw, 
  Layers, 
  Activity, 
  FileText, 
  Truck, 
  CheckCircle2, 
  TrendingUp, 
  Settings,
  Users,
  LogOut,
  Lock
} from 'lucide-react';
import { Badge, Button } from '../ui';
import { DealFlowApiClient } from '../../services/apiClient';

interface HeaderNavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { activeRole, roleTitle, isCustomer, currentUser, logout, isSalesRep, isSalesManager, isFinanceDirector, isAdmin } = useRole();
  const { activeDeal, resetDemoToGoldenPath, evaluation } = useDealFlow();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<'CHECKING' | 'LIVE' | 'STANDALONE'>('CHECKING');

  React.useEffect(() => {
    let isMounted = true;
    DealFlowApiClient.checkHealth()
      .then((res) => {
        if (isMounted) setGatewayStatus(res.gateway ? 'LIVE' : 'STANDALONE');
      })
      .catch(() => {
        if (isMounted) setGatewayStatus('STANDALONE');
      });
    return () => { isMounted = false; };
  }, []);


  // Navigation tabs strictly role-gated based on authenticated session
  const navTabs = React.useMemo(() => {
    if (isCustomer) {
      return [
        { id: 'customer-quote', label: 'My Quotation', icon: <FileText className="w-4 h-4" /> },
        { id: 'customer-negotiate', label: 'Negotiate Terms', icon: <Activity className="w-4 h-4" /> },
      ];
    }

    if (isSalesRep) {
      return [
        { id: 'cockpit', label: 'Deal Cockpit', icon: <FileText className="w-4 h-4" /> },
        { id: 'deals-list', label: 'My Deals', icon: <Layers className="w-4 h-4" /> },
        { id: 'pipeline', label: 'Pipeline', icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'billing', label: 'Billing', icon: <Activity className="w-4 h-4" /> },
      ];
    }

    if (isSalesManager) {
      return [
        { id: 'control-tower', label: 'Control Tower', icon: <ShieldCheck className="w-4 h-4" /> },
        { id: 'approvals', label: 'Approval Center', icon: <CheckCircle2 className="w-4 h-4" /> },
        { id: 'customers-tiers', label: 'Customers & Tiers', icon: <Users className="w-4 h-4" /> },
        { id: 'cockpit', label: 'Deal Cockpit', icon: <FileText className="w-4 h-4" /> },
        { id: 'deals-list', label: 'All Deals', icon: <Layers className="w-4 h-4" /> },
      ];
    }

    if (isFinanceDirector) {
      return [
        { id: 'control-tower', label: 'Control Tower', icon: <ShieldCheck className="w-4 h-4" /> },
        { id: 'approvals', label: 'Approval Center', icon: <CheckCircle2 className="w-4 h-4" /> },
        { id: 'cockpit', label: 'Deal Cockpit', icon: <FileText className="w-4 h-4" /> },
        { id: 'deals-list', label: 'All Deals', icon: <Layers className="w-4 h-4" /> },
      ];
    }

    if (isAdmin) {
      return [
        { id: 'admin-dashboard', label: 'Admin & Operations', icon: <Settings className="w-4 h-4" /> },
        { id: 'control-tower', label: 'Control Tower', icon: <ShieldCheck className="w-4 h-4" /> },
        { id: 'cockpit', label: 'Deal Cockpit', icon: <FileText className="w-4 h-4" /> },
        { id: 'admin-config', label: 'Policy Rules & Limits', icon: <ShieldCheck className="w-4 h-4" /> },
      ];
    }

    return [{ id: 'cockpit', label: 'Deal Cockpit', icon: <FileText className="w-4 h-4" /> }];
  }, [isCustomer, isSalesRep, isSalesManager, isFinanceDirector, isAdmin]);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
      {/* Top Status Bar: Global Product Status & Authenticated Persona */}
      <div className="bg-slate-900 text-slate-200 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-white tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>DEALFLOW360</span>
            <span className="text-slate-400 font-normal">| Odoo Governance Engine</span>
          </div>
          <span className="hidden sm:inline-block text-slate-500">·</span>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
            <span>GATEWAY:</span>
            <span className={gatewayStatus === 'LIVE' ? "text-emerald-400 font-medium" : "text-brand-300 font-medium"}>
              {gatewayStatus === 'LIVE' ? 'LIVE (FastAPI v1.0.0)' : 'STANDALONE (Deterministic Engine)'}
            </span>
          </div>
          <span className="hidden sm:inline-block text-slate-500">·</span>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
            <span>ODOO RPC:</span>
            <span className="text-emerald-400 font-medium">CONNECTED (sale.order #SO-2026-084)</span>
          </div>
        </div>


        <div className="flex items-center gap-3">
          {/* Active Deal Status Quick Pill (Enterprise only) */}
          {!isCustomer && (
            <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              <span className="text-slate-400">Target Deal:</span>
              <span className="text-white font-medium">{activeDeal.dealNumber} ({activeDeal.customerName})</span>
              <span className={`w-2 h-2 rounded-full ${
                evaluation.severity === 'LOW' ? 'bg-emerald-400' :
                evaluation.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'
              }`}></span>
              <span className="font-mono text-slate-200">Risk {evaluation.blendedRiskScore}</span>
            </div>
          )}

          {/* Golden Demo Reset Button (Enterprise only) */}
          {!isCustomer && (
            <button
              onClick={() => setResetConfirmOpen(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded-md border border-slate-700 transition-colors cursor-pointer text-xs"
              title="Reset to pristine initial state"
            >
              <RotateCcw className="w-3.5 h-3.5 text-brand-400" />
              <span className="font-medium">Reset Demo</span>
            </button>
          )}

          {/* Immutable Authenticated Identity Pill (NO role switching) */}
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-md border border-slate-700 text-xs text-slate-200">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="font-semibold text-white">{currentUser?.name || 'User'}</span>
            <span className="text-slate-500">·</span>
            <span className="text-[11px] font-mono text-brand-300 font-medium">{activeRole}</span>
          </div>
        </div>
      </div>

      {/* Primary Navigation Bar */}
      <div className="px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setCurrentTab(isCustomer ? 'customer-quote' : 'cockpit')}>
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm">
              DF
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base tracking-tight">DealFlow<span className="text-brand-600">360</span></span>
              <span className="text-[10px] block text-slate-500 font-medium leading-none">
                {isCustomer ? 'Client Quotation Portal' : 'Sales Operations Platform'}
              </span>
            </div>
          </div>

          {/* Navigation Links (Strictly Filtered by Active Role) */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1">
            {navTabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Info: User Profile Status & Log Out */}
        <div className="flex items-center gap-3">
          {isCustomer && (
            <Badge variant="purple" size="md">
              Restricted Client Session
            </Badge>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={<LogOut className="w-3.5 h-3.5 text-slate-500" />}
            onClick={logout}
          >
            Log Out
          </Button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-brand-600" />
              Reset Demo to Golden Path
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              This will restore Acme Corp deal <strong>D1024</strong> to its initial pristine baseline (10 Laptops, 10% Setup service discount, 12 Support months, Risk 12 SAFE). All simulated counteroffers and test modifications will be cleared.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setResetConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  resetDemoToGoldenPath();
                  setResetConfirmOpen(false);
                  setCurrentTab('cockpit');
                }}
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

import React, { useState } from 'react';
import { AuthService } from '../../security/authService';
import { useRole } from '../../app/providers/RoleContext';
import { Badge, Button } from '../ui';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';

interface EnterpriseLoginProps {
  onSuccess: () => void;
  onGoToCustomerLogin: () => void;
}

export const EnterpriseLogin: React.FC<EnterpriseLoginProps> = ({ onSuccess, onGoToCustomerLogin }) => {
  const { setAuthenticatedUser } = useRole();
  const [username, setUsername] = useState('sales.rep');
  const [password, setPassword] = useState('DealFlow@Rep2026');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await AuthService.loginEnterprise(username, password);
      if (res.user) {
        setAuthenticatedUser(res.user);
        if (res.user.role === 'ADMIN') {
          window.location.hash = '/admin';
        } else if (res.user.role === 'SALES_MANAGER' || res.user.role === 'FINANCE_DIRECTOR') {
          window.location.hash = '/manager';
        } else {
          window.location.hash = '/sales';
        }
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Authentication failed.');
      }
    } catch {
      setErrorMsg('Server connection error during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Top Portal Switcher Bar */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6 flex justify-center">
        <div className="inline-flex bg-slate-200/90 p-1 rounded-xl shadow-inner gap-1">
          <div className="px-4 py-2 rounded-lg bg-white text-slate-900 text-xs font-bold shadow-xs flex items-center gap-1.5 border border-slate-200/80">
            <span>🏢</span>
            <span>Enterprise Staff Portal</span>
          </div>
          <button
            type="button"
            onClick={onGoToCustomerLogin}
            className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>🌐</span>
            <span>B2B Customer Portal</span>
          </button>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white font-bold text-xl mb-3 shadow-md">
          DF
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          DealFlow<span className="text-brand-600">360</span> Enterprise
        </h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Internal Sales Operations &amp; Commercial Governance System
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-sm rounded-2xl border border-slate-200">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Enterprise Username / Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  placeholder="e.g. sales.rep or sales.manager"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading}
              className="w-full mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In to Enterprise Workspace'}
            </Button>
          </form>

          {/* Quick Demo Credentials Strip */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              One-Click Demo Roles
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('sales.rep', 'DealFlow@Rep2026')}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="font-bold text-slate-900">💼 Sales Rep</div>
                <div className="text-[10px] text-slate-500">Rahul Sharma</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('sales.manager', 'DealFlow@Manager2026')}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="font-bold text-slate-900">🛡️ Sales Manager</div>
                <div className="text-[10px] text-slate-500">Sunita Nair</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('finance.director', 'DealFlow@Finance2026')}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="font-bold text-slate-900">⚖️ Finance VP</div>
                <div className="text-[10px] text-slate-500">Vikram Malhotra</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('admin', 'DealFlow@Admin2026')}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="font-bold text-slate-900">⚙️ Admin</div>
                <div className="text-[10px] text-slate-500">System Admin</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('rep.unassigned', 'DealFlow@Rep2026')}
                className="p-2 text-left rounded-lg border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 transition-colors cursor-pointer"
              >
                <div className="font-bold text-amber-900">⚠️ Unassigned Rep</div>
                <div className="text-[10px] text-amber-700">Test Work Assignment</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('customer.demo', 'DealFlow@Customer2026')}
                className="p-2 text-left rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100/60 transition-colors cursor-pointer"
              >
                <div className="font-bold text-rose-900">🚫 Customer Login</div>
                <div className="text-[10px] text-rose-700">Test 403 Rejection</div>
              </button>
            </div>
          </div>

          {/* Switch to Customer Portal Link */}
          <div className="mt-5 text-center pt-4 border-t border-slate-100">
            <button
              onClick={onGoToCustomerLogin}
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Switch to B2B Customer Portal Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { AuthService } from '../../security/authService';
import { useRole } from '../../app/providers/RoleContext';
import { Button } from '../ui';
import { Building2, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

interface CustomerLoginProps {
  onSuccess: () => void;
  onGoToEnterpriseLogin: () => void;
}

export const CustomerLogin: React.FC<CustomerLoginProps> = ({ onSuccess, onGoToEnterpriseLogin }) => {
  const { setAuthenticatedUser } = useRole();
  const [username, setUsername] = useState('customer.demo');
  const [password, setPassword] = useState('DealFlow@Customer2026');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await AuthService.loginCustomer(username, password);
      if (res.user) {
        setAuthenticatedUser(res.user);
        window.location.hash = '/customer';
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Authentication failed.');
      }
    } catch {
      setErrorMsg('Network error connecting to Customer Portal.');
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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Top Portal Switcher Bar */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6 flex justify-center">
        <div className="inline-flex bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-700/60 gap-1">
          <button
            type="button"
            onClick={onGoToEnterpriseLogin}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>🏢</span>
            <span>Enterprise Staff Portal</span>
          </button>
          <div className="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 border border-brand-500">
            <span>🌐</span>
            <span>B2B Customer Portal</span>
          </div>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 text-white font-bold text-xl mb-3 shadow-md">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">
          DealFlow<span className="text-brand-400">360</span> Customer Portal
        </h2>
        <p className="mt-1 text-xs text-slate-400 font-medium">
          Dedicated B2B Client Quotation &amp; Negotiation Gateway
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl rounded-2xl border border-slate-700">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Client Portal Account / Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-600 focus:outline-none"
                  placeholder="e.g. customer.demo"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Portal Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading}
              className="w-full mt-2 bg-brand-600 hover:bg-brand-500 text-white border-brand-600"
            >
              {loading ? 'Validating Account...' : 'Sign In to Customer Portal'}
            </Button>
          </form>

          {/* Quick Demo Credentials Strip */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Demo Client Account
            </div>
            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('customer.demo', 'DealFlow@Customer2026')}
                className="w-full p-2.5 text-left rounded-lg border border-brand-200 bg-brand-50/50 hover:bg-brand-100/50 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-brand-900">🌐 Acme Corp Global (Buyer)</div>
                  <div className="text-[10px] text-brand-700 font-mono">customer.demo / DealFlow@Customer2026</div>
                </div>
                <span className="text-brand-600 font-bold text-xs">Fill ➔</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('sales.rep', 'DealFlow@Rep2026')}
                className="w-full p-2 text-left rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100/60 transition-colors cursor-pointer"
              >
                <div className="font-bold text-rose-900">🚫 Enterprise Credential (Test 403 Rejection)</div>
                <div className="text-[10px] text-rose-700 font-mono">sales.rep / DealFlow@Rep2026</div>
              </button>
            </div>
          </div>

          {/* Switch to Enterprise Login Link */}
          <div className="mt-5 text-center pt-4 border-t border-slate-100">
            <button
              onClick={onGoToEnterpriseLogin}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Internal Employee? Switch to Enterprise Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

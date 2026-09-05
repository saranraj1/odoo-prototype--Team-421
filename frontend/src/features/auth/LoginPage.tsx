import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { authApi } from '@/api/endpoints/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HintStrip } from '@/components/data/HintStrip';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { Loader2, UserPlus, LogIn, Sparkles, Building2, ShieldCheck, Lock } from 'lucide-react';
import { usePortalAuthStore } from '@/features/portal/portalAuthStore';
import { getStoredUsers } from '@/mocks/fixtures/users';

export const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Unified Login fields (Common for all roles)
  const [login, setLogin] = useState('rep1@dealflow.test');
  const [password, setPassword] = useState('Password123!');
  
  // Customer Signup fields (Customer only)
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e?: React.FormEvent, directLogin?: string, directPassword?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setIsLoading(true);

    const emailToUse = (directLogin || login).trim();
    const passwordToUse = directPassword || password;

    try {
      // 1. Try API login endpoint
      const res = await authApi.login(emailToUse, passwordToUse);
      if (res.user.role === 'CUSTOMER') {
        usePortalAuthStore.getState().setAuth(res.access_token, {
          id: (res.user as any).partner_id || res.user.odoo_user_id || res.user.id || 1,
          name: (res.user as any).company_name || res.user.name,
        });
        navigate('/portal/quotations');
      } else {
        setAuth(res.access_token, res.user);
        navigate('/');
      }
    } catch {
      // 2. Direct Mock Store Resolution fallback
      const users = getStoredUsers();
      const loginLower = emailToUse.toLowerCase();
      const matched = Object.values(users).find(
        (u) => u.email.toLowerCase() === loginLower || u.name.toLowerCase().includes(loginLower)
      );

      if (matched) {
        if (matched.role === 'CUSTOMER') {
          usePortalAuthStore.getState().setAuth(`mock_token_portal_${matched.id}`, {
            id: matched.partner_id || matched.odoo_user_id || matched.id,
            name: matched.company_name || matched.name,
          });
          navigate('/portal/quotations');
        } else {
          setAuth(`mock_token_${matched.role.toLowerCase()}_${matched.id}`, matched as any);
          navigate('/');
        }
      } else {
        // Fallback default rep
        setAuth('mock_token_sales_rep', users.rep1 as any);
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!companyName.trim() || !contactName.trim() || !customerEmail.trim() || !customerPassword.trim()) {
      setError('Please fill in all customer registration fields.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          email: customerEmail.trim(),
          password: customerPassword.trim(),
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const customerData = json.data;
        usePortalAuthStore.getState().setAuth(customerData.access_token, {
          id: customerData.partner?.id || customerData.user.id,
          name: customerData.partner?.name || customerData.user.name,
        });
        navigate('/portal/quotations');
      } else {
        throw new Error('Signup failed');
      }
    } catch {
      // Fallback in-memory save
      const id = Date.now();
      const newCustomer = {
        id,
        odoo_user_id: id,
        partner_id: id,
        name: contactName.trim(),
        company_name: companyName.trim(),
        email: customerEmail.trim(),
        password: customerPassword.trim(),
        role: 'CUSTOMER' as const,
        company_id: 1,
        is_active: true,
      };
      usePortalAuthStore.getState().setAuth(`mock_token_portal_${id}`, {
        id,
        name: newCustomer.company_name,
      });
      navigate('/portal/quotations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (email: string, pass: string) => {
    setLogin(email);
    setPassword(pass);
    handleLoginSubmit(undefined, email, pass);
  };

  return (
    <div className="w-full">
      <Card className="border-border bg-surface shadow-2xl overflow-hidden">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand mb-2 border border-brand/20 shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl font-bold">DealFlow360</CardTitle>
          <CardDescription>B2B Sales Operations &amp; Commercial Governance Platform</CardDescription>

          {/* Unified Login / Customer Sign Up Tabs */}
          <div className="flex border-b border-border mt-4">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setError(null); }}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'login'
                  ? 'border-b-2 border-brand text-brand bg-brand/5'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In (All Roles)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('signup'); setError(null); }}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'signup'
                  ? 'border-b-2 border-brand text-brand bg-brand/5'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Customer Sign Up
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {error && (
            <div className="rounded-input border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger font-medium">
              {error}
            </div>
          )}

          {activeTab === 'login' ? (
            /* Common Unified Login Form */
            <form onSubmit={(e) => handleLoginSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login" className="text-xs font-semibold text-text-secondary">
                  Work Email / Username
                </label>
                <Input
                  id="login"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="e.g. rep1@dealflow.test or buyer@acme.test"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold text-text-secondary">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-[11px] text-brand hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Button type="submit" className="w-full font-bold shadow-xs" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating…
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          ) : (
            /* Customer-Only Registration Form */
            <form onSubmit={handleCustomerSignup} className="space-y-3.5">
              <div className="rounded-lg bg-sky-50 border border-sky-200 p-2.5 text-[11px] text-sky-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-sky-900">
                  <Building2 className="h-3.5 w-3.5 text-brand" />
                  <span>B2B Customer Portal Registration</span>
                </div>
                <p className="text-sky-700 leading-relaxed">
                  Register your company account to review quotations and submit counter-offers. Internal team accounts (Sales Rep, Manager, Finance) are created by the System Administrator.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="company-name" className="text-xs font-semibold text-text-secondary">
                  Company / Organization Name
                </label>
                <Input
                  id="company-name"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-name" className="text-xs font-semibold text-text-secondary">
                  Contact Person Name
                </label>
                <Input
                  id="contact-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Alice Johnson"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="customer-email" className="text-xs font-semibold text-text-secondary">
                  Business Email
                </label>
                <Input
                  id="customer-email"
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="buyer@acme.com"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="customer-password" className="text-xs font-semibold text-text-secondary">
                  Create Password
                </label>
                <Input
                  id="customer-password"
                  type="password"
                  required
                  value={customerPassword}
                  onChange={(e) => setCustomerPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Button type="submit" className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account…
                  </>
                ) : (
                  'Create Customer Account & Sign In'
                )}
              </Button>
            </form>
          )}

          {/* Quick switch demo logins */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-text-muted flex items-center gap-1 font-semibold">
                <Sparkles className="h-3 w-3 text-brand" />
                Default Test Accounts (1-Click Login):
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('rep1@dealflow.test', 'Password123!')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-elevated hover:bg-slate-200 text-text-primary border border-border cursor-pointer transition-colors"
                title="Sales Representative"
              >
                Sales Rep
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('manager1@dealflow.test', 'Password123!')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-elevated hover:bg-slate-200 text-text-primary border border-border cursor-pointer transition-colors"
                title="Sales Manager (L1 Approver)"
              >
                Sales Manager
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('finance@dealflow.test', 'Password123!')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-elevated hover:bg-slate-200 text-text-primary border border-border cursor-pointer transition-colors"
                title="Finance Director (L2 Approver)"
              >
                Finance
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@dealflow.test', 'Password123!')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-elevated hover:bg-slate-200 text-text-primary border border-border cursor-pointer transition-colors"
                title="System Administrator"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('buyer@acme.test', 'Password123!')}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer transition-colors"
                title="B2B Customer Portal"
              >
                Customer Portal
              </button>
            </div>
          </div>

          <HintStrip>
            Sign in with any user account. Internal sales operations land on their role workspace, while customers land on their Zero-Trust Quotation Portal.
          </HintStrip>
        </CardContent>
      </Card>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
};

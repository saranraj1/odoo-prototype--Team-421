import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { authApi } from '@/api/endpoints/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HintStrip } from '@/components/data/HintStrip';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { Loader2, UserPlus, LogIn, Building2, ShieldCheck } from 'lucide-react';
import { usePortalAuthStore } from '@/features/portal/portalAuthStore';

export const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Unified Login fields (Common for all roles)
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  
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

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsLoading(true);

    const emailToUse = login.trim();
    const passwordToUse = password;

    try {
      const res = await authApi.login(emailToUse, passwordToUse);
      if (res.user.role === 'CUSTOMER') {
        useAuthStore.getState().clearAuth();
        usePortalAuthStore.getState().setAuth(res.access_token, {
          id: (res.user as any).partner_id || res.user.odoo_user_id || res.user.id || 1,
          name: (res.user as any).company_name || res.user.name,
        });
        navigate('/portal/quotations');
      } else {
        usePortalAuthStore.getState().clearAuth();
        setAuth(res.access_token, res.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password. Please check your credentials.');
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
        useAuthStore.getState().clearAuth();
        usePortalAuthStore.getState().setAuth(customerData.access_token, {
          id: customerData.partner?.id || customerData.user.id,
          name: customerData.partner?.name || customerData.user.name,
        });
        navigate('/portal/quotations');
      } else {
        throw new Error('Registration failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Customer registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
                  type="text"
                  autoComplete="username"
                  required
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="e.g. sales.rep or rep1@dealflow.test"
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

          {/* Customer Portal Link */}
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
            <span>Customer or Partner account?</span>
            <Link to="/portal/login" className="font-semibold text-emerald-700 hover:underline flex items-center gap-1">
              Customer Portal Login &rarr;
            </Link>
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

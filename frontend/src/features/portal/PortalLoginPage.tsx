import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HintStrip } from '@/components/data/HintStrip';
import { authApi } from '@/api/endpoints/auth';
import { usePortalAuthStore } from './portalAuthStore';
import { useAuthStore } from '@/features/auth/authStore';
import { Loader2, ShieldCheck, MailCheck, KeyRound, ArrowRight, Users } from 'lucide-react';

export const PortalLoginPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<'password' | 'magic'>('password');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [magicSubmitted, setMagicSubmitted] = useState(false);

  const { setAuth } = usePortalAuthStore();
  const navigate = useNavigate();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsLoading(true);

    const emailToUse = login.trim();
    const passToUse = password;

    try {
      const res = await authApi.portalLogin(emailToUse, passToUse);
      if (res.is_internal && res.user) {
        // Internal team member logged in! Route cleanly to internal dashboard
        usePortalAuthStore.getState().clearAuth();
        useAuthStore.getState().setAuth(res.access_token, res.user);
        navigate('/');
        return;
      }

      // Customer account logged in
      useAuthStore.getState().clearAuth();
      setAuth(res.access_token, res.partner);
      navigate('/portal/quotations');
    } catch (err: any) {
      setError(err?.message || 'Invalid login or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.requestMagicLink(login);
      setMagicSubmitted(true);
    } catch {
      setMagicSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border bg-surface shadow-2xl">
      <CardHeader className="text-center pb-3">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-chip bg-emerald-600/20 text-emerald-700 mb-2">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl font-bold">Customer Portal Access</CardTitle>
        <CardDescription>Zero-trust quotation review &amp; negotiation portal</CardDescription>

        {/* Banner to redirect to enterprise login */}
        <div className="mt-3 flex items-center justify-between rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-900">
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="h-3.5 w-3.5 text-brand" />
            Internal team member?
          </span>
          <Link
            to="/login"
            className="flex items-center gap-1 font-bold text-brand hover:underline"
          >
            <span>Enterprise Sign In</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Tab switch between Password and Magic Link */}
        <div className="flex border-b border-border mt-3">
          <button
            type="button"
            onClick={() => { setAuthMode('password'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              authMode === 'password'
                ? 'border-b-2 border-emerald-600 text-emerald-700 font-bold'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Password Login
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('magic'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              authMode === 'magic'
                ? 'border-b-2 border-emerald-600 text-emerald-700 font-bold'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <MailCheck className="h-3.5 w-3.5" />
            Magic Link
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        {error && (
          <div className="rounded-input border border-danger/40 bg-danger/15 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {authMode === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="portal-login" className="text-xs font-semibold text-text-secondary">
                Email / Login
              </label>
              <Input
                id="portal-login"
                type="text"
                autoComplete="username"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="e.g. buyer@acme.test or buyer.acme"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="portal-password" className="text-xs font-semibold text-text-secondary">
                Password
              </label>
              <Input
                id="portal-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                'Log In to Portal'
              )}
            </Button>
          </form>
        ) : magicSubmitted ? (
          <div className="text-center py-4 space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-chip bg-success/20 text-success">
              <MailCheck className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold text-text-primary">Magic Link Dispatched</h4>
            <p className="text-xs text-text-secondary max-w-xs mx-auto">
              If an account exists for <span className="text-text-primary font-medium">{login}</span>, a direct sign-in link has been sent to your inbox.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setMagicSubmitted(false)}
            >
              Try another email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="magic-email" className="text-xs font-semibold text-text-secondary">
                Your Business Email
              </label>
              <Input
                id="magic-email"
                type="email"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="buyer@company.com"
              />
            </div>

            <Button type="submit" className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Link…
                </>
              ) : (
                'Send Sign-In Link'
              )}
            </Button>
          </form>
        )}



        <HintStrip>
          All internal costs, margins, and approval thresholds are strictly stripped before rendering in the customer portal.
        </HintStrip>
      </CardContent>
    </Card>
  );
};

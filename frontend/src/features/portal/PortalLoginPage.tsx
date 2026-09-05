import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HintStrip } from '@/components/data/HintStrip';
import { authApi } from '@/api/endpoints/auth';
import { usePortalAuthStore } from './portalAuthStore';
import { Loader2, ShieldCheck, MailCheck, KeyRound } from 'lucide-react';

export const PortalLoginPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<'password' | 'magic'>('password');
  const [login, setLogin] = useState('buyer@acme.test');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [magicSubmitted, setMagicSubmitted] = useState(false);

  const { setAuth } = usePortalAuthStore();
  const navigate = useNavigate();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await authApi.portalLogin(login, password);
      setAuth(res.access_token, res.partner);
      navigate('/portal');
    } catch (err: any) {
      setError(err.message || 'Invalid customer login or password.');
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
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-chip bg-brand/20 text-brand mb-2">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl font-bold">Customer Portal Access</CardTitle>
        <CardDescription>Zero-trust quotation review &amp; negotiation portal</CardDescription>

        {/* Tab switch between Password and Magic Link */}
        <div className="flex border-b border-border mt-4">
          <button
            type="button"
            onClick={() => { setAuthMode('password'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              authMode === 'password'
                ? 'border-b-2 border-brand text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Password Login
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('magic'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              authMode === 'magic'
                ? 'border-b-2 border-brand text-text-primary'
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
                Customer Email / Login
              </label>
              <Input
                id="portal-login"
                type="email"
                inputMode="email"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="buyer@acme.test"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="portal-password" className="text-xs font-semibold text-text-secondary">
                Portal Password
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

            <Button type="submit" className="w-full font-bold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                'Log In to Customer Portal'
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

            <Button type="submit" className="w-full font-bold" disabled={isLoading}>
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

        {/* Quick Demo Customer Selectors */}
        <div className="pt-2 border-t border-border/60">
          <p className="text-[10px] text-text-muted mb-1.5">Quick Demo Customers:</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => { setLogin('buyer@acme.test'); setPassword('Password123!'); setAuthMode('password'); }}
              className="px-2 py-0.5 rounded text-[10px] bg-elevated hover:bg-elevated/80 text-text-secondary border border-border"
            >
              Acme Corp (buyer@acme.test)
            </button>
            <button
              type="button"
              onClick={() => { setLogin('buyer@beta.test'); setPassword('Password123!'); setAuthMode('password'); }}
              className="px-2 py-0.5 rounded text-[10px] bg-elevated hover:bg-elevated/80 text-text-secondary border border-border"
            >
              Beta Ltd (buyer@beta.test)
            </button>
            <button
              type="button"
              onClick={() => { setLogin('buyer@gamma.test'); setPassword('Password123!'); setAuthMode('password'); }}
              className="px-2 py-0.5 rounded text-[10px] bg-elevated hover:bg-elevated/80 text-text-secondary border border-border"
            >
              Gamma Inc (buyer@gamma.test)
            </button>
          </div>
        </div>

        <HintStrip>
          All internal costs, margins, and approval thresholds are strictly stripped before rendering in the customer portal.
        </HintStrip>
      </CardContent>
    </Card>
  );
};

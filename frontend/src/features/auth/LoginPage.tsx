import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { authApi } from '@/api/endpoints/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { usePortalAuthStore } from '@/features/portal/portalAuthStore';

import { queryClient } from '@/app/providers';

export const LoginPage: React.FC = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      queryClient.clear();
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
      setError(err?.message || 'Invalid username or password. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Back to Home Page link */}
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors p-1 -ml-1 rounded-md hover:bg-slate-100/60"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
          <span>Back to Home Page</span>
        </Link>
      </div>

      <Card className="border-border bg-surface shadow-2xl overflow-hidden">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand mb-2 border border-brand/20 shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl font-bold">DealFlow360</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {error && (
            <div className="rounded-input border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger font-medium">
              {error}
            </div>
          )}

          {/* Unified Login Form */}
          <form onSubmit={(e) => handleLoginSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login" className="text-xs font-semibold text-text-secondary">
                Username or Email
              </label>
              <Input
                id="login"
                type="text"
                autoComplete="username"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="e.g. sales.rep or customer.demo"
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

              {/* Password field with Eye Toggle Button */}
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-colors"
                  title={showPassword ? 'Hide password' : 'View password'}
                  aria-label={showPassword ? 'Hide password' : 'View password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full font-bold shadow-xs" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                'Sign In to Portal'
              )}
            </Button>
          </form>


        </CardContent>
      </Card>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
};

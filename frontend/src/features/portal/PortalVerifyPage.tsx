import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints/auth';
import { usePortalAuthStore } from './portalAuthStore';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const PortalVerifyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = usePortalAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing authentication token.');
      return;
    }

    authApi
      .verifyMagicLink(token)
      .then((res) => {
        setAuth(res.access_token, res.partner);
        navigate('/portal/quotations', { replace: true });
      })
      .catch((err) => {
        setError(err.message || 'The magic link has expired or is invalid.');
      });
  }, [searchParams, setAuth, navigate]);

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-border bg-surface shadow-2xl p-6 text-center">
        <CardContent className="space-y-4 pt-4">
          {error ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-chip bg-danger/20 text-danger">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-text-primary">Verification Failed</h3>
              <p className="text-xs text-text-secondary">{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => navigate('/portal/login')}
              >
                Back to Portal Login
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-8 w-8 text-brand animate-spin" />
              <h3 className="text-base font-semibold text-text-primary">Verifying Customer Access…</h3>
              <p className="text-xs text-text-secondary">
                Securely negotiating session keys with DealFlow360…
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

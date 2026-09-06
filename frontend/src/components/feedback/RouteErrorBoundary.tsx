import React from 'react';
import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  let errorMessage = 'An unexpected application error occurred.';
  let errorStatus: number | string = 'Error';

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || 'Page or resource not found.';
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center p-6">
      <Card className="max-w-lg w-full border-border bg-surface shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-2 pt-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-3 border border-amber-500/20 shadow-xs">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 inline-block mb-1">
            Status: {errorStatus}
          </span>
          <CardTitle className="text-lg font-bold text-text-primary">
            Something went wrong
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5 text-center">
          <p className="text-xs text-text-secondary leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3 rounded-md border border-border font-mono text-left break-words">
            {errorMessage}
          </p>

          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Go Back
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload Page
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-1.5 text-xs font-semibold"
            >
              <Home className="h-3.5 w-3.5" />
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

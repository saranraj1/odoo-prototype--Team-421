import React from 'react';
import { AlertCircle, Lock, ServerCrash, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center rounded-card border border-dashed border-border bg-surface/50 my-4">
    <Inbox className="h-10 w-10 text-text-muted mb-3" />
    <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
    {description && <p className="text-xs text-text-secondary mt-1 max-w-sm">{description}</p>}
    {actionLabel && onAction && (
      <Button size="sm" variant="outline" className="mt-4" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);

export const ErrorState: React.FC<{
  message?: string;
  onRetry?: () => void;
}> = ({ message = 'Failed to load data from server.', onRetry }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center rounded-card border border-danger/30 bg-danger/10 my-4">
    <AlertCircle className="h-10 w-10 text-danger mb-3" />
    <h4 className="text-sm font-semibold text-text-primary">Error Encountered</h4>
    <p className="text-xs text-text-secondary mt-1 max-w-sm">{message}</p>
    {onRetry && (
      <Button size="sm" variant="danger" className="mt-4" onClick={onRetry}>
        Retry Request
      </Button>
    )}
  </div>
);

export const ForbiddenState: React.FC<{
  requiredRoles?: string[];
  userRole?: string;
}> = ({ requiredRoles, userRole }) => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
    <Lock className="h-12 w-12 text-warning mb-3" />
    <h3 className="text-lg font-bold text-text-primary">Access Restricted</h3>
    <p className="text-sm text-text-secondary mt-1 max-w-md">
      Your current role ({userRole || 'Unknown'}) does not have permission to view this section.
    </p>
    {requiredRoles && (
      <p className="text-xs text-text-muted mt-2">
        Allowed roles: {requiredRoles.join(', ')}
      </p>
    )}
  </div>
);

export const CapabilityMissingState: React.FC<{
  methodName?: string;
}> = ({ methodName }) => (
  <div className="flex flex-col items-center justify-center p-6 text-center rounded-card border border-warning/40 bg-warning/10 my-4">
    <ServerCrash className="h-8 w-8 text-warning mb-2" />
    <h4 className="text-sm font-semibold text-text-primary">Odoo Capability Missing</h4>
    <p className="text-xs text-text-secondary mt-1 max-w-md">
      This action requires Odoo method <code className="bg-elevated px-1.5 py-0.5 rounded text-warning">{methodName || 'unknown'}</code> which isn't available on the connected Odoo instance.
    </p>
  </div>
);

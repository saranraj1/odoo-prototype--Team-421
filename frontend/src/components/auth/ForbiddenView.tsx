import React from 'react';
import { useRole } from '../../app/providers/RoleContext';
import { Button, Card, Badge } from '../ui';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

interface ForbiddenViewProps {
  requestedPath?: string;
  onReturnToHome: () => void;
}

export const ForbiddenView: React.FC<ForbiddenViewProps> = ({ requestedPath, onReturnToHome }) => {
  const { currentUser, activeRole, logout } = useRole();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center bg-white shadow-xl border border-rose-200">
        <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <Badge variant="danger" size="md" className="mb-2">
          HTTP 403 · Access Forbidden
        </Badge>

        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Unauthorized Resource Access
        </h2>

        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          Your authenticated identity (<strong>{currentUser?.name || 'User'}</strong> with role{' '}
          <strong className="font-mono text-rose-700">{activeRole || 'UNAUTHENTICATED'}</strong>) is not authorized
          to access {requestedPath ? <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">{requestedPath}</span> : 'this enterprise area'}.
        </p>

        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={onReturnToHome}
          >
            Return to Authorized Workspace
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<LogOut className="w-3.5 h-3.5 text-slate-400" />}
            onClick={logout}
          >
            Log Out &amp; Switch Account
          </Button>
        </div>
      </Card>
    </div>
  );
};

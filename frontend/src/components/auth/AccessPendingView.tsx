import React from 'react';
import { useRole } from '../../app/providers/RoleContext';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { Button, Card, Badge } from '../ui';
import { ShieldAlert, UserCheck, LogOut, Clock, ArrowRight } from 'lucide-react';

export const AccessPendingView: React.FC = () => {
  const { currentUser, logout, refreshSession } = useRole();
  const { assignUserAccess } = useDealFlow();

  const handleSimulateAdminGrant = async () => {
    if (currentUser) {
      assignUserAccess(currentUser.id);
      await refreshSession();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full p-8 text-center bg-white shadow-xl border border-slate-200">
        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8" />
        </div>

        <Badge variant="warning" size="md" className="mb-2">
          Assignment Status: PENDING
        </Badge>

        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Application Access Pending
        </h2>

        <div className="mt-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 text-left space-y-1">
          <div>Authenticated Account: <strong className="text-slate-900">{currentUser?.name}</strong></div>
          <div>Role Requested: <strong className="text-slate-900">{currentUser?.role}</strong></div>
          <div>System Identifier: <span className="font-mono text-slate-500">{currentUser?.username}</span></div>
        </div>

        <p className="mt-4 text-xs text-slate-600 leading-relaxed">
          Your account credentials have been authenticated, but your operational application access has not yet been assigned by a system administrator.
        </p>

        <p className="mt-2 text-xs text-slate-500">
          Please contact your administrator to activate your work role.
        </p>

        {/* Demo Fast-Track Action */}
        <div className="mt-6 pt-5 border-t border-slate-100 space-y-2.5">
          <Button
            variant="primary"
            size="sm"
            className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white"
            icon={<UserCheck className="w-4 h-4" />}
            onClick={handleSimulateAdminGrant}
          >
            [Demo] Simulate Admin Assigning Work Access
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            icon={<LogOut className="w-4 h-4" />}
            onClick={logout}
          >
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
};

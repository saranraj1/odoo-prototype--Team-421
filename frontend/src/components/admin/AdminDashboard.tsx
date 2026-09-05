import React, { useState } from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { UserRole } from '../../types';
import { FulfillmentView } from '../fulfillment/FulfillmentView';
import { AdminConfigView } from './AdminConfigView';
import { Badge, Button, Card } from '../ui';
import { 
  Settings, 
  Users, 
  Truck, 
  BarChart3, 
  ShieldAlert, 
  UserCheck, 
  UserX, 
  Key, 
  CheckCircle2, 
  TrendingUp,
  PieChart
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { users, assignUserAccess, revokeUserAccess, toggleUserActiveStatus, deals, allEvaluations } = useDealFlow();
  const [activeTab, setActiveTab] = useState<'users' | 'fulfillment' | 'config' | 'analytics'>('users');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-lg shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-900" />
            Platform Administration &amp; Governance Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            System configuration, user access assignment, warehouse fulfillment ownership, and platform analytics
          </p>
        </div>

        <Badge variant="purple" size="md">
          Administrative Privileges Active
        </Badge>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
            activeTab === 'users' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users &amp; Work Assignment</span>
        </button>

        <button
          onClick={() => setActiveTab('fulfillment')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
            activeTab === 'fulfillment' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Fulfillment &amp; Warehouses</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
            activeTab === 'config' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Tier &amp; Policy Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
            activeTab === 'analytics' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Platform Analytics</span>
        </button>
      </div>

      {/* Users & Work Assignment Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Enterprise Internal Accounts &amp; Operational Work Assignment
            </h3>
            <span className="text-xs text-slate-500">
              Total Accounts: <strong>{users.length}</strong>
            </span>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">User &amp; Username</th>
                    <th className="py-3 px-3">Assigned Role</th>
                    <th className="py-3 px-3">Account Status</th>
                    <th className="py-3 px-3">Work Assignment</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isPending = u.assignmentStatus === 'PENDING';
                    const isInactive = u.status === 'INACTIVE';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {u.username} · {u.email}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              u.role === 'ADMIN' ? 'purple' :
                              u.role === 'FINANCE_DIRECTOR' ? 'danger' :
                              u.role === 'SALES_MANAGER' ? 'info' :
                              u.role === 'CUSTOMER' ? 'neutral' : 'success'
                            }
                            size="sm"
                          >
                            {u.role}
                          </Badge>
                        </td>

                        <td className="py-3 px-3">
                          <Badge variant={isInactive ? 'danger' : 'success'} size="sm">
                            {u.status}
                          </Badge>
                        </td>

                        <td className="py-3 px-3">
                          <Badge variant={isPending ? 'warning' : 'success'} size="sm">
                            {isPending ? '⏳ PENDING ASSIGNMENT' : '✓ ASSIGNED'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-right space-x-2">
                          {isPending ? (
                            <Button
                              variant="success"
                              size="sm"
                              icon={<UserCheck className="w-3.5 h-3.5" />}
                              onClick={() => {
                                assignUserAccess(u.id);
                                showToast(`Work access granted to ${u.name}. User can now access ${u.role} dashboard.`);
                              }}
                            >
                              Assign Work Access
                            </Button>
                          ) : (
                            u.role !== 'ADMIN' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  revokeUserAccess(u.id);
                                  showToast(`Work access revoked for ${u.name}.`);
                                }}
                              >
                                Revoke Access
                              </Button>
                            )
                          )}

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              toggleUserActiveStatus(u.id);
                              showToast(`Status toggled for ${u.name}.`);
                            }}
                          >
                            {isInactive ? 'Activate' : 'Deactivate'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Fulfillment Ownership Tab */}
      {activeTab === 'fulfillment' && (
        <FulfillmentView />
      )}

      {/* Tier & Policy Configuration Tab */}
      {activeTab === 'config' && (
        <AdminConfigView />
      )}

      {/* Platform Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Customer Distribution Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 border-amber-200 bg-amber-50/40">
              <span className="text-xs font-bold uppercase text-amber-800 block">Gold Tier Customers</span>
              <div className="text-3xl font-black font-mono text-amber-900 mt-1">42%</div>
              <p className="text-xs text-amber-700 mt-1">Ceiling: 15.0% · Avg Discount: 11.4%</p>
            </Card>

            <Card className="p-5 border-sky-200 bg-sky-50/40">
              <span className="text-xs font-bold uppercase text-sky-800 block">Silver Tier Customers</span>
              <div className="text-3xl font-black font-mono text-sky-900 mt-1">35%</div>
              <p className="text-xs text-sky-700 mt-1">Ceiling: 10.0% · Avg Discount: 7.2%</p>
            </Card>

            <Card className="p-5 border-slate-200 bg-slate-50/40">
              <span className="text-xs font-bold uppercase text-slate-800 block">Bronze Tier Customers</span>
              <div className="text-3xl font-black font-mono text-slate-900 mt-1">23%</div>
              <p className="text-xs text-slate-700 mt-1">Ceiling: 5.0% · Avg Discount: 3.8%</p>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Platform Governance Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">Total Active Orders</span>
                <span className="font-mono font-bold text-slate-900 text-lg">{deals.length}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Average Platform Margin</span>
                <span className="font-mono font-bold text-emerald-600 text-lg">26.4%</span>
              </div>
              <div>
                <span className="text-slate-400 block">Ceiling Breaches Intercepted</span>
                <span className="font-mono font-bold text-rose-600 text-lg">100%</span>
              </div>
              <div>
                <span className="text-slate-400 block">Odoo Synchronization</span>
                <span className="font-mono font-bold text-brand-600 text-lg">Real-Time</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

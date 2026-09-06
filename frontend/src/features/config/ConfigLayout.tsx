import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { HintStrip } from '@/components/data/HintStrip';
import { configApi } from '@/api/endpoints/config';
import { useMutation } from '@tanstack/react-query';
import { Check, Sliders, ShieldCheck, Box, Settings, Users, UserPlus, KeyRound, Edit2, Trash2, Eye, EyeOff, Building2, RotateCcw } from 'lucide-react';
import { getStoredUsers, saveStoredUsers, INITIAL_MOCK_USERS, type UserAccountData } from '@/mocks/fixtures/users';
import type { UserRole } from '@/lib/rbac';
import { useAuthStore } from '@/features/auth/authStore';

export const ConfigLayout: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'users' | 'tiers' | 'pricelists' | 'routing' | 'warehouses' | 'subscriptions' | 'upsell' | 'system'>(
    isAdmin ? 'users' : 'tiers'
  );
  const [managerThreshold, setManagerThreshold] = useState(20);
  const [financeThreshold, setFinanceThreshold] = useState(50);
  const [singleLinePts, setSingleLinePts] = useState(8);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // User Management State (Restricted strictly to System Administrator)
  const [userList, setUserList] = useState<UserAccountData[]>([]);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [createInternalOpen, setCreateInternalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccountData | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'internal' | 'customer'>('all');

  // Customer User Creation form state (STRICTLY CUSTOMER PORTAL)
  const [custName, setCustName] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPassword, setCustPassword] = useState('Password123!');

  // Internal User Creation form state (STRICTLY INTERNAL WORKSPACE)
  const [intName, setIntName] = useState('');
  const [intRole, setIntRole] = useState<'SALES_REP' | 'SALES_MANAGER' | 'FINANCE' | 'ADMIN'>('SALES_REP');
  const [intEmail, setIntEmail] = useState('');
  const [intPassword, setIntPassword] = useState('Password123!');

  // Form states for editing user
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'SALES_REP' | 'SALES_MANAGER' | 'FINANCE' | 'ADMIN'>('SALES_REP');
  const [editCompany, setEditCompany] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const loadUsers = () => {
    const raw = getStoredUsers();
    if (Object.keys(raw).length <= 7) {
      saveStoredUsers(INITIAL_MOCK_USERS);
      setUserList(Object.values(INITIAL_MOCK_USERS));
    } else {
      setUserList(Object.values(raw));
    }
  };

  // Guard activeTab if user role changes or non-admin attempts to view users tab
  useEffect(() => {
    if (!isAdmin && activeTab === 'users') {
      setActiveTab('tiers');
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custEmail.trim()) return;

    const id = Date.now();
    const emailPrefix = custEmail.split('@')[0].toLowerCase();
    const newCustomer: UserAccountData = {
      id,
      odoo_user_id: id,
      partner_id: id,
      name: custName.trim(),
      email: custEmail.trim(),
      username: emailPrefix,
      aliases: [
        custName.toLowerCase(),
        emailPrefix,
        custName.toLowerCase().replace(/\s+/g, '.'),
      ],
      role: 'CUSTOMER',
      password: custPassword.trim() || 'Password123!',
      company_id: 1,
      company_name: custCompany.trim() || 'Client Enterprise',
      is_active: true,
    };

    const currentUsers = getStoredUsers();
    currentUsers[`user_${id}`] = newCustomer;
    saveStoredUsers(currentUsers);
    loadUsers();
    setCreateCustomerOpen(false);
    setCustName('');
    setCustCompany('');
    setCustEmail('');
    setCustPassword('Password123!');
  };

  const handleCreateInternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intName.trim() || !intEmail.trim()) return;

    const id = Date.now();
    const emailPrefix = intEmail.split('@')[0].toLowerCase();
    const newInternalUser: UserAccountData = {
      id,
      odoo_user_id: id,
      name: intName.trim(),
      email: intEmail.trim(),
      username: emailPrefix,
      aliases: [
        intName.toLowerCase(),
        emailPrefix,
        intName.toLowerCase().replace(/\s+/g, '.'),
      ],
      role: intRole,
      password: intPassword.trim() || 'Password123!',
      company_id: 1,
      company_name: 'DealFlow Enterprise Inc',
      is_active: true,
    };

    const currentUsers = getStoredUsers();
    currentUsers[`user_${id}`] = newInternalUser;
    saveStoredUsers(currentUsers);
    loadUsers();
    setCreateInternalOpen(false);
    setIntName('');
    setIntEmail('');
    setIntRole('SALES_REP');
    setIntPassword('Password123!');
  };

  const handleOpenEdit = (user: UserAccountData) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    if (user.role !== 'CUSTOMER') {
      setEditRole(user.role as any);
    }
    setEditCompany(user.company_name || '');
    setEditPassword(user.password || 'Password123!');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const currentUsers = getStoredUsers();
    const key = Object.keys(currentUsers).find((k) => currentUsers[k].id === editingUser.id);
    if (key) {
      const isCustomer = editingUser.role === 'CUSTOMER';
      currentUsers[key] = {
        ...currentUsers[key],
        name: editName.trim(),
        email: editEmail.trim(),
        role: isCustomer ? 'CUSTOMER' : editRole,
        company_name: isCustomer
          ? (editCompany.trim() || 'Client Enterprise')
          : (currentUsers[key].company_name || 'DealFlow Enterprise Inc'),
        password: editPassword.trim(),
      };
      saveStoredUsers(currentUsers);
      loadUsers();
    }
    setEditingUser(null);
  };

  const handleDeleteUser = (id: number) => {
    if (!confirm('Are you sure you want to remove this user account?')) return;
    const currentUsers = getStoredUsers();
    const key = Object.keys(currentUsers).find((k) => currentUsers[k].id === id);
    if (key) {
      delete currentUsers[key];
      saveStoredUsers(currentUsers);
      loadUsers();
    }
  };

  const togglePasswordVisibility = (id: number) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      configApi.updateSettings({
        manager_threshold: managerThreshold,
        finance_threshold: financeThreshold,
        single_line_finance_pts: singleLinePts,
      }),
    onSuccess: () => {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <PageHeader
        title={isAdmin ? "Platform Governance & Administration" : "Governance & Policy Configuration"}
        subtitle={
          isAdmin
            ? "Manage user credentials, calibrate approval thresholds, and configure policy parameters"
            : "Calibrate approval thresholds, discount rules, and configure governance policy parameters"
        }
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && activeTab === 'users' ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    saveStoredUsers(INITIAL_MOCK_USERS);
                    setUserList(Object.values(INITIAL_MOCK_USERS));
                  }}
                  className="gap-1.5 font-semibold text-brand border-brand/30 hover:bg-brand/10 shadow-2xs cursor-pointer"
                  title="Reload all 31 realistic enterprise personas and customer accounts"
                >
                  <RotateCcw className="h-4 w-4" />
                  Load Realistic Users (31)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCustName('');
                    setCustCompany('');
                    setCustEmail('');
                    setCustPassword('Password123!');
                    setCreateCustomerOpen(true);
                  }}
                  className="gap-1.5 font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 shadow-2xs cursor-pointer"
                >
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  Add Customer User
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setIntName('');
                    setIntRole('SALES_REP');
                    setIntEmail('');
                    setIntPassword('Password123!');
                    setCreateInternalOpen(true);
                  }}
                  className="gap-1.5 font-bold shadow-xs cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Internal User
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="gap-1.5 font-bold shadow-xs"
              >
                {savedSuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    Saved!
                  </>
                ) : (
                  'Save Configuration'
                )}
              </Button>
            )}
          </div>
        }
      />

      {/* Configuration Tabs */}
      <div className="flex border-b border-border space-x-1 overflow-x-auto pb-px">
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'users' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Users &amp; Credentials
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('tiers')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'tiers' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Discount Rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pricelists')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'pricelists' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Price Lists
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('routing')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'routing' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Approval Chains
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('warehouses')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'warehouses' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Box className="h-3.5 w-3.5" />
          Warehouses
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'subscriptions' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Subscription Plans
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upsell')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'upsell' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Upsell / Cross-Sell Rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'system' ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          System Telemetry
        </button>
      </div>

      {/* Tab: Users & Credentials - STRICTLY ADMIN ONLY */}
      {isAdmin && activeTab === 'users' && (
        <div className="space-y-6">
          <Card className="border-border bg-surface shadow-xs">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand" />
                    Internal Team &amp; Customer Portal Accounts
                  </CardTitle>
                  <CardDescription>
                    Administrator governance controls for provisioning usernames, roles, and passwords across internal and customer portal personas.
                  </CardDescription>
                </div>
                {/* Segmented Filter */}
                <div className="flex items-center gap-1 bg-elevated p-1 rounded-lg border border-border shrink-0 text-xs">
                  <button
                    type="button"
                    onClick={() => setUserFilter('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      userFilter === 'all'
                        ? 'bg-white text-text-primary shadow-2xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    All ({userList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilter('internal')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      userFilter === 'internal'
                        ? 'bg-white text-text-primary shadow-2xs'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Internal ({userList.filter((u) => u.role !== 'CUSTOMER').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilter('customer')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      userFilter === 'customer'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    <Building2 className="h-3 w-3 text-emerald-600" />
                    Customer ({userList.filter((u) => u.role === 'CUSTOMER').length})
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-elevated text-text-secondary border-b border-border font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Full Name</th>
                      <th className="px-4 py-3">Email / Username</th>
                      <th className="px-4 py-3">Role / Persona</th>
                      <th className="px-4 py-3">Password</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {userList
                      .filter((u) => {
                        if (userFilter === 'internal') return u.role !== 'CUSTOMER';
                        if (userFilter === 'customer') return u.role === 'CUSTOMER';
                        return true;
                      })
                      .map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-text-primary flex items-center gap-2.5">
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              user.role === 'CUSTOMER' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-brand/10 text-brand'
                            }`}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-900 truncate">{user.name}</span>
                            {user.role === 'CUSTOMER' && user.company_name ? (
                              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-emerald-600 inline shrink-0" />
                                {user.company_name}
                              </span>
                            ) : (
                              <span className="text-[10px] text-text-muted font-normal">
                                {user.company_name || 'DealFlow Enterprise Inc'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-text-secondary">
                          {user.email}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-chip text-[10px] font-bold uppercase tracking-wider ${
                              user.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : user.role === 'SALES_MANAGER'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : user.role === 'FINANCE' || user.role === 'FINANCE_DIRECTOR'
                                ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                : user.role === 'CUSTOMER'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}
                          >
                            {user.role === 'CUSTOMER' ? 'CUSTOMER PORTAL' : user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="text-text-primary font-medium">
                              {showPasswords[user.id] ? user.password || 'Password123!' : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
                              title={showPasswords[user.id] ? 'Hide password' : 'Show password'}
                            >
                              {showPasswords[user.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(user)}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </Button>
                          {user.role !== 'ADMIN' && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteUser(user.id)}
                              className="h-7 px-2 text-xs"
                              title="Delete user"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <HintStrip>
            Any user account created or edited here is immediately updated in the authentication store and can be used to log in from the common login screen.
          </HintStrip>
        </div>
      )}

      {/* Tab: Tiers / Discount Rules */}
      {activeTab === 'tiers' && (
        <div className="space-y-4">
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Customer Discount Ceilings & Rules</CardTitle>
              <CardDescription>Tiered discount governance ceilings enforcing deterministic approval triggers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <span className="font-bold text-text-primary block">Platinum Tier</span>
                  <p className="text-text-muted mt-1">Discount Ceiling: <strong>20.0%</strong></p>
                  <p className="text-text-muted">Approval: Above 20%</p>
                </div>
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <span className="font-bold text-text-primary block">Gold Tier</span>
                  <p className="text-text-muted mt-1">Discount Ceiling: <strong>15.0%</strong></p>
                  <p className="text-text-muted">Approval: Above 15%</p>
                </div>
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <span className="font-bold text-text-primary block">Silver Tier</span>
                  <p className="text-text-muted mt-1">Discount Ceiling: <strong>10.0%</strong></p>
                  <p className="text-text-muted">Approval: Above 10%</p>
                </div>
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <span className="font-bold text-text-primary block">Bronze Tier</span>
                  <p className="text-text-muted mt-1">Discount Ceiling: <strong>5.0%</strong></p>
                  <p className="text-text-muted">Approval: Above 5%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Price Lists */}
      {activeTab === 'pricelists' && (
        <div className="space-y-4">
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Enterprise Price Lists & Customer Tiers</CardTitle>
              <CardDescription>Multi-currency price lists, volume brackets, and effective pricing rules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <div className="flex items-center justify-between font-bold text-text-primary">
                    <span>Public Price List (USD)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">Active</span>
                  </div>
                  <p className="text-text-muted mt-1">Standard list price without volume discount.</p>
                  <p className="text-text-muted mt-0.5">Applies to: Bronze / Standard B2B</p>
                </div>
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <div className="flex items-center justify-between font-bold text-text-primary">
                    <span>Corporate Enterprise (USD)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">Active</span>
                  </div>
                  <p className="text-text-muted mt-1">10% base contract discount on HW, 15% on SW.</p>
                  <p className="text-text-muted mt-0.5">Applies to: Silver &amp; Gold Tiers</p>
                </div>
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <div className="flex items-center justify-between font-bold text-text-primary">
                    <span>Strategic Global Partner (USD)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">Active</span>
                  </div>
                  <p className="text-text-muted mt-1">Custom formula pricing with annual rebate schedule.</p>
                  <p className="text-text-muted mt-0.5">Applies to: Platinum Key Accounts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Routing */}
      {activeTab === 'routing' && (
        <div className="space-y-4">
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Approval Chains &amp; Escalation Thresholds</CardTitle>
              <CardDescription>Configure Level 1 (Manager) and Level 2 (Finance) routing trigger thresholds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="cfg-manager-threshold" className="text-xs font-semibold text-text-secondary">
                    Sales Manager Approval (Score ≥)
                  </label>
                  <Input
                    id="cfg-manager-threshold"
                    type="number"
                    value={managerThreshold}
                    onChange={(e) => setManagerThreshold(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-text-muted">Deals scoring ≥ {managerThreshold} require Level 1 Approval.</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cfg-finance-threshold" className="text-xs font-semibold text-text-secondary">
                    Finance Escalation (Score ≥)
                  </label>
                  <Input
                    id="cfg-finance-threshold"
                    type="number"
                    value={financeThreshold}
                    onChange={(e) => setFinanceThreshold(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-text-muted">Deals scoring ≥ {financeThreshold} require Level 2 Finance Approval.</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cfg-single-line-pts" className="text-xs font-semibold text-text-secondary">
                    Single Line Excess Penalty
                  </label>
                  <Input
                    id="cfg-single-line-pts"
                    type="number"
                    value={singleLinePts}
                    onChange={(e) => setSingleLinePts(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-text-muted">Risk points per % discount above tier limit.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Subscriptions */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Recurring Subscription Plans &amp; Proration Rules</CardTitle>
              <CardDescription>Configure SaaS recurring frequencies, proration models, and cancellation policies.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <span className="font-bold text-text-primary block">Enterprise SaaS Annual</span>
                  <p className="text-text-muted mt-1">Frequency: <strong>Annual (12-Mo upfront)</strong></p>
                  <p className="text-text-muted">Proration: Exact-day linear</p>
                  <p className="text-text-muted">Auto-Renew: Enabled (60d notice)</p>
                </div>
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <span className="font-bold text-text-primary block">Professional Monthly</span>
                  <p className="text-text-muted mt-1">Frequency: <strong>Monthly recurring</strong></p>
                  <p className="text-text-muted">Proration: Mid-cycle coterminous</p>
                  <p className="text-text-muted">Auto-Renew: Monthly auto-bill</p>
                </div>
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <span className="font-bold text-text-primary block">Premium 24/7 SLA Addon</span>
                  <p className="text-text-muted mt-1">Frequency: <strong>Co-termed to parent sub</strong></p>
                  <p className="text-text-muted">Proration: Day-1 aligned</p>
                  <p className="text-text-muted">Auto-Renew: Synchronized</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Upsell / Cross-Sell */}
      {activeTab === 'upsell' && (
        <div className="space-y-4">
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Upsell &amp; Cross-Sell Recommendation Rules</CardTitle>
              <CardDescription>Rule-based product pairing triggers evaluated in real-time in Quotation Workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <div className="flex items-center justify-between font-bold text-text-primary">
                    <span>Server Hardware → 24/7 SLA</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-100 text-sky-800">High Priority</span>
                  </div>
                  <p className="text-text-muted mt-1">Trigger: When Server or Router line added.</p>
                  <p className="text-text-muted mt-0.5">Min Margin Threshold: 25%</p>
                </div>
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <div className="flex items-center justify-between font-bold text-text-primary">
                    <span>Hardware License → Onboarding Pack</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-100 text-sky-800">Medium Priority</span>
                  </div>
                  <p className="text-text-muted mt-1">Trigger: When Order Subtotal &gt; $10,000.</p>
                  <p className="text-text-muted mt-0.5">Min Margin Threshold: 30%</p>
                </div>
                <div className="p-3 rounded-card bg-elevated/40 border border-border">
                  <div className="flex items-center justify-between font-bold text-text-primary">
                    <span>Annual License → 3-Year Multi-Year Pack</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">Promo Active</span>
                  </div>
                  <p className="text-text-muted mt-1">Trigger: When 1-Yr Subscription selected.</p>
                  <p className="text-text-muted mt-0.5">Discount Incentive: +5% extra margin</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Warehouses */}
      {activeTab === 'warehouses' && (
        <div className="space-y-4">
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Configured Warehouse Hubs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded border border-border bg-elevated/20">
                  <span className="font-bold text-text-primary">Main Warehouse (WH/Stock)</span>
                  <p className="text-text-muted mt-0.5">Priority: 1 (Primary) · Lead Time: 2 Days</p>
                </div>
                <div className="p-3 rounded border border-border bg-elevated/20">
                  <span className="font-bold text-text-primary">East Depot (WH/East)</span>
                  <p className="text-text-muted mt-0.5">Priority: 2 (Regional Depot) · Lead Time: 4 Days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: System */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <Card className="border-border bg-surface">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">System Governance Telemetry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-text-secondary">Odoo RPC Engine:</span>
                <span className="font-semibold text-success">CONNECTED (Odoo 18.0 CE)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-text-secondary">Deal Guardian Evaluator:</span>
                <span className="font-semibold text-text-primary">ACTIVE (Deterministic scoring)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-secondary">MSW State Mocking:</span>
                <span className="font-semibold text-brand">ACTIVE (Local storage sync)</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialogs: Create Customer, Create Internal & Edit User - STRICTLY ADMIN ONLY */}
      {isAdmin && (
        <>
          {/* 1. Dialog: Create Customer User (STRICTLY CUSTOMER PORTAL - NO INTERNAL ROLES) */}
          <Dialog
            open={createCustomerOpen}
            onOpenChange={setCreateCustomerOpen}
            title="Provision Customer Portal User"
            description="Create external credentials for a customer client to log in, review quotations, and negotiate orders."
          >
            <form onSubmit={handleCreateCustomer} className="space-y-4 pt-2">
              <div className="rounded-lg bg-emerald-50/90 border border-emerald-200 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-900">B2B Customer Portal Account</p>
                  <p className="text-emerald-800 text-[11px] mt-0.5 leading-relaxed">
                    This account is provisioned exclusively for the external customer portal. Cost margins, approval thresholds, and internal notes are strictly stripped from their session.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-cust-name" className="text-xs font-semibold text-text-secondary">
                  Customer Contact / Buyer Name
                </label>
                <Input
                  id="create-cust-name"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Alice Johnson"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-cust-company" className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                  <span>Customer Company / Organization</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.5 rounded">Partner Entity</span>
                </label>
                <Input
                  id="create-cust-company"
                  required
                  value={custCompany}
                  onChange={(e) => setCustCompany(e.target.value)}
                  placeholder="e.g. Acme Corp, Globex Industries"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-cust-email" className="text-xs font-semibold text-text-secondary">
                  Email / Login Username
                </label>
                <Input
                  id="create-cust-email"
                  type="email"
                  required
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  placeholder="buyer@acme.test"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-cust-password" className="text-xs font-semibold text-text-secondary">
                  Initial Password
                </label>
                <Input
                  id="create-cust-password"
                  type="text"
                  required
                  value={custPassword}
                  onChange={(e) => setCustPassword(e.target.value)}
                  placeholder="Password123!"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreateCustomerOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Create Customer User
                </Button>
              </div>
            </form>
          </Dialog>

          {/* 2. Dialog: Create Internal User (STRICTLY INTERNAL WORKSPACE - NO CUSTOMER OPTION) */}
          <Dialog
            open={createInternalOpen}
            onOpenChange={setCreateInternalOpen}
            title="Provision Internal Team User"
            description="Create credentials and assign an internal governance role to a team member."
          >
            <form onSubmit={handleCreateInternal} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label htmlFor="create-int-name" className="text-xs font-semibold text-text-secondary">
                  Full Name
                </label>
                <Input
                  id="create-int-name"
                  required
                  value={intName}
                  onChange={(e) => setIntName(e.target.value)}
                  placeholder="e.g. Rahul Verma"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-int-role" className="text-xs font-semibold text-text-secondary">
                  Assigned Internal Role
                </label>
                <Select
                  id="create-int-role"
                  value={intRole}
                  onChange={(e) => setIntRole(e.target.value as any)}
                >
                  <option value="SALES_REP">Sales Representative (Rep)</option>
                  <option value="SALES_MANAGER">Sales Manager (L1 Approver)</option>
                  <option value="FINANCE">Finance Director (L2 Approver)</option>
                  <option value="ADMIN">System Administrator</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-int-email" className="text-xs font-semibold text-text-secondary">
                  Email / Login Username
                </label>
                <Input
                  id="create-int-email"
                  type="email"
                  required
                  value={intEmail}
                  onChange={(e) => setIntEmail(e.target.value)}
                  placeholder="rahul@dealflow.test"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="create-int-password" className="text-xs font-semibold text-text-secondary">
                  Initial Password
                </label>
                <Input
                  id="create-int-password"
                  type="text"
                  required
                  value={intPassword}
                  onChange={(e) => setIntPassword(e.target.value)}
                  placeholder="Password123!"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreateInternalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm" className="font-bold">
                  Create Internal User
                </Button>
              </div>
            </form>
          </Dialog>

          {/* 3. Dialog: Edit User (Bifurcated: Customer vs Internal) */}
          <Dialog
            open={!!editingUser}
            onOpenChange={(open) => !open && setEditingUser(null)}
            title={editingUser?.role === 'CUSTOMER' ? "Edit Customer Portal Account" : "Edit Internal User & Credentials"}
            description={
              editingUser?.role === 'CUSTOMER'
                ? "Update customer buyer contact name, organization, login email, or password."
                : "Update team member full name, assigned internal role, login email, or password."
            }
          >
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              {editingUser?.role === 'CUSTOMER' ? (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="edit-cust-name" className="text-xs font-semibold text-text-secondary">
                      Customer Contact / Buyer Name
                    </label>
                    <Input
                      id="edit-cust-name"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="edit-cust-company" className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                      <span>Customer Company / Organization</span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.5 rounded">Partner Entity</span>
                    </label>
                    <Input
                      id="edit-cust-company"
                      required
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="edit-int-name" className="text-xs font-semibold text-text-secondary">
                      Full Name
                    </label>
                    <Input
                      id="edit-int-name"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="edit-int-role" className="text-xs font-semibold text-text-secondary">
                      Assigned Internal Role
                    </label>
                    <Select
                      id="edit-int-role"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as any)}
                    >
                      <option value="SALES_REP">Sales Representative (Rep)</option>
                      <option value="SALES_MANAGER">Sales Manager (L1 Approver)</option>
                      <option value="FINANCE">Finance Director (L2 Approver)</option>
                      <option value="ADMIN">System Administrator</option>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label htmlFor="edit-user-email" className="text-xs font-semibold text-text-secondary">
                  Email / Login Username
                </label>
                <Input
                  id="edit-user-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-user-password" className="text-xs font-semibold text-text-secondary">
                  Password
                </label>
                <Input
                  id="edit-user-password"
                  type="text"
                  required
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  className={`font-bold ${editingUser?.role === 'CUSTOMER' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </Dialog>
        </>
      )}
    </div>
  );
};

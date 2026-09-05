import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User as UserIcon, Shield, Layers } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { getTabsForRole, UserRole } from '@/lib/rbac';
import { NotificationsDrawer } from './NotificationsDrawer';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/api/endpoints/notifications';
import { queryKeys } from '@/api/queryKeys';

export const TopNav: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: () => notificationsApi.list(true),
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const allowedTabs = getTabsForRole(user?.role as UserRole);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-white px-6 text-text-primary shadow-xs select-none backdrop-blur-xs bg-white/95">
        {/* Brand & Tabs */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer font-bold text-base tracking-tight text-slate-900"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white shadow-xs">
              <Shield className="h-4 w-4 fill-white" />
            </div>
            <div className="flex flex-col">
              <span className="leading-tight">DealFlow<span className="text-brand">360</span></span>
              <span className="text-[10px] font-normal text-text-muted leading-tight">Sales Governance</span>
            </div>
          </div>

          <nav className="flex items-center space-x-1">
            {allowedTabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right side: Notifications & User Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative rounded-lg p-2 text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30"
            aria-label={`Notifications, ${unreadCount} unread`}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {user && (
            <div className="flex items-center gap-2.5 pl-2 border-l border-border">
              <div className="flex items-center gap-2 text-xs font-medium text-text-primary bg-slate-50 border border-border px-2.5 py-1 rounded-lg">
                <UserIcon className="h-3.5 w-3.5 text-text-muted" />
                <span className="font-semibold">{user.name}</span>
                <span className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-danger transition-colors border border-transparent hover:border-rose-200"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <NotificationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        notifications={notifications}
      />
    </>
  );
};

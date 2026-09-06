import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';
import { getTabsForRole, UserRole } from '@/lib/rbac';
import { NotificationsDrawer } from './NotificationsDrawer';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/api/endpoints/notifications';
import { queryKeys } from '@/api/queryKeys';

import { queryClient } from '@/app/providers';

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
    queryClient.clear();
    clearAuth();
    navigate('/login');
  };

  const allowedTabs = getTabsForRole(user?.role as UserRole);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 lg:px-8 text-slate-800 shadow-xs select-none backdrop-blur-md">
        {/* Brand & Tabs */}
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer shrink-0 group py-1"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand to-sky-600 text-white shadow-xs shadow-brand/20 group-hover:scale-105 transition-transform duration-200">
              <Shield className="h-5 w-5 fill-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-slate-900 leading-tight">
                DealFlow<span className="text-brand">360</span>
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider leading-tight">
                Sales Governance
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block shrink-0" />

          <nav className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1">
            {allowedTabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-900 text-white font-semibold shadow-xs shadow-slate-900/10'
                      : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right side: Notifications & User Menu */}
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 cursor-pointer"
            aria-label={`Notifications, ${unreadCount} unread`}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {user && (
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-lg shadow-2xs">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600 font-bold text-[10px]">
                  {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-3 w-3" />}
                </div>
                <span className="font-semibold text-slate-800 max-w-[120px] truncate">{user.name}</span>
                <span className="rounded bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-transparent transition-colors cursor-pointer"
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

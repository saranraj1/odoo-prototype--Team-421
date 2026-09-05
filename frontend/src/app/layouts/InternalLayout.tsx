import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';

export const InternalLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-app flex flex-col">
      <TopNav />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        <Outlet />
      </main>
    </div>
  );
};

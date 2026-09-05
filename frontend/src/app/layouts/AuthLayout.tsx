import React from 'react';
import { Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-app flex flex-col justify-center items-center p-4">
      <div className="mb-6 flex items-center gap-2 font-bold text-2xl text-text-primary">
        <div className="p-2 rounded-chip bg-brand text-brand-ink">
          <Shield className="h-6 w-6 fill-brand-ink" />
        </div>
        <span>DealFlow360</span>
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
};

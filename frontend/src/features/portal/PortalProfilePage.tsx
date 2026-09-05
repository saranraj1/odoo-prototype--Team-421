import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePortalAuthStore } from './portalAuthStore';
import { useNavigate } from 'react-router-dom';

export const PortalProfilePage: React.FC = () => {
  const { partner, clearAuth } = usePortalAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/portal/login');
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <PageHeader
        title="Customer Profile"
        subtitle="Manage your portal session and organization details"
      />

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="space-y-1">
            <span className="text-text-muted">Organization Name:</span>
            <p className="font-bold text-sm text-text-primary">{partner?.name || 'Acme Corp'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-text-muted">Partner Account ID:</span>
            <p className="font-mono text-text-primary">#{partner?.id || 1}</p>
          </div>

          <div className="pt-4 border-t border-border">
            <Button variant="danger" size="sm" onClick={handleLogout}>
              Sign Out of Portal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

import React, { useState } from 'react';
import { Play, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { healthApi } from '@/api/endpoints/health';
import { configApi } from '@/api/endpoints/config';

export const DemoControls: React.FC = () => {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();

  const handleOpenSeededDeal = () => {
    navigate('/quotations/deal_d1024_acme');
  };

  const handleOpenPortalAsAcme = async () => {
    try {
      const outbox = await configApi.getOutbox();
      const magicItem = outbox?.find((o: any) => o.recipient?.includes('acme') || o.token);
      if (magicItem?.token) {
        window.open(`/portal/verify?token=${encodeURIComponent(magicItem.token)}`, '_blank');
      } else {
        window.open('/login', '_blank');
      }
    } catch {
      window.open('/login', '_blank');
    }
  };

  const handleRecomputeAlerts = async () => {
    await healthApi.recomputeAlerts();
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="rounded-card border border-brand/40 bg-surface/95 shadow-2xl backdrop-blur p-2.5 text-xs text-text-primary">
        <div className="flex items-center justify-between gap-3 font-semibold pb-1.5 border-b border-border">
          <div className="flex items-center gap-1.5 text-brand">
            <Sparkles className="h-4 w-4" />
            <span>Golden Demo Runner</span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-text-muted hover:text-text-primary"
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="flex flex-col gap-1.5 mt-2 pt-1 min-w-[220px]">
            <Button size="sm" variant="default" onClick={handleOpenSeededDeal} className="h-7 text-xs">
              <Play className="h-3 w-3 mr-1" />
              1. Open D-1024 (Acme)
            </Button>
            <Button size="sm" variant="secondary" onClick={handleOpenPortalAsAcme} className="h-7 text-xs">
              2. Open Acme Portal
            </Button>
            <Button size="sm" variant="outline" onClick={handleRecomputeAlerts} className="h-7 text-xs">
              Recompute Health Alerts
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

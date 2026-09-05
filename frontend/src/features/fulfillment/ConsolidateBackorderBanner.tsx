import React from 'react';
import { PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConsolidateBackorderBannerProps {
  onConsolidate: () => void;
  isLoading?: boolean;
}

export const ConsolidateBackorderBanner: React.FC<ConsolidateBackorderBannerProps> = ({
  onConsolidate,
  isLoading = false,
}) => {
  return (
    <div className="flex items-center justify-between rounded-input border border-warning/50 bg-warning/15 px-4 py-3 text-xs text-warning shadow-md">
      <div className="flex items-center gap-2.5">
        <PackageCheck className="h-5 w-5 shrink-0" />
        <div>
          <span className="font-bold block text-text-primary">
            Restock Detected in Main Warehouse
          </span>
          <p className="text-[11px] text-text-secondary">
            Stock replenishment arrived for pending backorders. You can consolidate shipments into a single delivery.
          </p>
        </div>
      </div>

      <Button
        size="sm"
        variant="warning"
        onClick={onConsolidate}
        disabled={isLoading}
        className="font-bold text-xs shrink-0"
      >
        Consolidate Remaining Backorder
      </Button>
    </div>
  );
};

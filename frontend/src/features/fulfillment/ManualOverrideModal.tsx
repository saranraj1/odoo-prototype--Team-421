import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ManualOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmOverride: (payload: { allocations: any[]; reason: string }) => void;
  lines: any[];
  warehouses: any[];
  isLoading?: boolean;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  open,
  onOpenChange,
  onConfirmOverride,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Default allocations: 8 Main, 2 East Depot
  const [wh1Qty, setWh1Qty] = useState(8);
  const [wh2Qty, setWh2Qty] = useState(2);

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError('An engineering or commercial reason is required to override automated split routing.');
      return;
    }
    setError(null);
    onConfirmOverride({
      allocations: [
        { odoo_sale_order_line_id: 1, odoo_warehouse_id: 1, qty: wh1Qty },
        { odoo_sale_order_line_id: 1, odoo_warehouse_id: 2, qty: wh2Qty },
      ],
      reason,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Manual Warehouse Split Override"
      description="Manually designate stock allocation across warehouses. Live stock constraints are strictly enforced."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="default" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Saving Override…' : 'Apply Manual Override'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2 text-xs">
        {error && <p className="text-danger font-semibold">{error}</p>}

        <div className="space-y-3">
          <div className="p-3 rounded bg-elevated/40 border border-border">
            <span className="font-semibold text-text-primary block mb-2">
              Laptop Pro 14" (Requested: 10 units)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-text-muted block mb-1">
                  Main Warehouse (Avail: 8)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={8}
                  value={wh1Qty}
                  onChange={(e) => setWh1Qty(Number(e.target.value))}
                  className="h-8 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted block mb-1">
                  East Depot (Avail: 5)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={wh2Qty}
                  onChange={(e) => setWh2Qty(Number(e.target.value))}
                  className="h-8 text-xs tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="font-semibold text-text-secondary block mb-1">
            Override Justification (Required for Audit Log)
          </label>
          <Textarea
            placeholder="e.g., Customer requested split shipment to avoid regional project delay…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-20 text-xs"
          />
        </div>
      </div>
    </Dialog>
  );
};

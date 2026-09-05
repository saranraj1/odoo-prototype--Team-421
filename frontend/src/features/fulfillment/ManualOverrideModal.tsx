import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface ManualOverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmOverride: (payload: { allocations: any[]; reason: string }) => void;
  lines: any[];
  warehouses?: any[];
  isLoading?: boolean;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  open,
  onOpenChange,
  onConfirmOverride,
  lines,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('Customer requested custom warehouse dispatch breakdown.');
  const [error, setError] = useState<string | null>(null);

  // Initialize from existing lines or defaults
  const [wh1Qty, setWh1Qty] = useState(8);
  const [wh2Qty, setWh2Qty] = useState(2);
  const requestedTotal = 10;

  useEffect(() => {
    if (open && lines && lines.length > 0) {
      const wh1 = lines.find((l: any) => l.odoo_warehouse_id === 1 || l.warehouse_name?.includes('Main'));
      const wh2 = lines.find((l: any) => l.odoo_warehouse_id === 2 || l.warehouse_name?.includes('East'));
      if (wh1) setWh1Qty(wh1.allocated_qty);
      if (wh2) setWh2Qty(wh2.allocated_qty);
    }
  }, [open, lines]);

  const totalAllocated = wh1Qty + wh2Qty;
  const isBalanced = totalAllocated === requestedTotal;

  const handleSubmit = () => {
    if (wh1Qty > 9) {
      setError('Main Warehouse only has 9 units available in Odoo stock.');
      return;
    }
    if (wh2Qty > 6) {
      setError('East Depot only has 6 units available in Odoo stock.');
      return;
    }
    if (!isBalanced) {
      setError(`Total allocated (${totalAllocated} units) must equal requested total of ${requestedTotal} units.`);
      return;
    }
    if (!reason.trim()) {
      setError('An engineering or commercial reason is required to log the manual override in Odoo audit.');
      return;
    }
    setError(null);
    onConfirmOverride({
      allocations: [
        { odoo_sale_order_line_id: 1, odoo_warehouse_id: 1, warehouse_name: 'Main Warehouse', qty: wh1Qty },
        { odoo_sale_order_line_id: 1, odoo_warehouse_id: 2, warehouse_name: 'East Depot', qty: wh2Qty },
      ],
      reason: reason.trim(),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Manual Warehouse Split Override"
      description="Manually designate stock allocation across Odoo warehouses. Live stock constraints are strictly enforced."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={handleSubmit}
            disabled={isLoading || !isBalanced}
            className="font-bold gap-1.5"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Saving Override…
              </>
            ) : (
              'Apply Manual Override'
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2 text-xs">
        {error && (
          <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="p-3.5 rounded-card bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                Laptop Pro 14" (Requested: {requestedTotal} units)
              </span>
              <div className="flex items-center gap-1.5">
                {isBalanced ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    {totalAllocated} / {requestedTotal} units allocated
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {totalAllocated} / {requestedTotal} units (
                    {totalAllocated < requestedTotal
                      ? `${requestedTotal - totalAllocated} remaining`
                      : `${totalAllocated - requestedTotal} excess`}
                    )
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Main Warehouse (WH1)
                </label>
                <div className="text-[10px] text-slate-500 mb-1.5">Available in Odoo: 9 units</div>
                <Input
                  type="number"
                  min={0}
                  max={9}
                  value={wh1Qty}
                  onChange={(e) => {
                    setError(null);
                    setWh1Qty(Math.max(0, Number(e.target.value)));
                  }}
                  className="h-8 text-xs font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  East Depot (WH2)
                </label>
                <div className="text-[10px] text-slate-500 mb-1.5">Available in Odoo: 6 units</div>
                <Input
                  type="number"
                  min={0}
                  max={6}
                  value={wh2Qty}
                  onChange={(e) => {
                    setError(null);
                    setWh2Qty(Math.max(0, Number(e.target.value)));
                  }}
                  className="h-8 text-xs font-bold tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            Override Justification (Logged to Odoo Audit Trail)
          </label>
          <Textarea
            placeholder="e.g., Regional fulfillment balance requested by logistics manager…"
            value={reason}
            onChange={(e) => {
              setError(null);
              setReason(e.target.value);
            }}
            className="h-20 text-xs"
          />
        </div>
      </div>
    </Dialog>
  );
};

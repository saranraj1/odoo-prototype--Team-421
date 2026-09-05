import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (confirmWithOpenRequests: boolean) => void;
  hasOpenRequests?: boolean;
  isLoading?: boolean;
}

export const ConfirmDealModal: React.FC<ConfirmDealModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  hasOpenRequests = false,
  isLoading = false,
}) => {
  const [withdrawOpenRequests, setWithdrawOpenRequests] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm and Accept Quotation"
      description="Review your order acceptance before sending the legal confirmation."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="success"
            onClick={() => onConfirm(withdrawOpenRequests)}
            disabled={isLoading || (hasOpenRequests && !withdrawOpenRequests)}
            className="font-bold gap-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Confirming…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Legally Confirm Order
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 py-2 text-xs text-text-secondary">
        <p>
          By confirming this quotation, you accept the commercial pricing, delivery terms, and items listed.
        </p>

        {hasOpenRequests && (
          <div className="p-3 rounded-input border border-warning/40 bg-warning/10 text-warning flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Open Negotiation Requests Pending</span>
              <p className="text-[11px] text-text-secondary leading-snug">
                You have active counter-proposals awaiting review. To confirm this quotation immediately on its current terms, please check the box below to withdraw all open requests.
              </p>
              <label className="flex items-center gap-2 pt-1 font-semibold text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={withdrawOpenRequests}
                  onChange={(e) => setWithdrawOpenRequests(e.target.checked)}
                  className="rounded border-border text-brand focus:ring-brand"
                />
                <span>Withdraw my open counter requests and confirm current quote</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};

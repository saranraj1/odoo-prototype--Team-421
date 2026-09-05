import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface CancelDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmCancel: (reason: string) => void;
  isLoading?: boolean;
}

export const CancelDealDialog: React.FC<CancelDealDialogProps> = ({
  open,
  onOpenChange,
  onConfirmCancel,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError('A cancellation explanation reason is mandatory.');
      return;
    }
    setError(null);
    onConfirmCancel(reason);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cancel Quotation"
      description="Cancelling will abort approval routing and release inventory reservations in Odoo."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Cancelling…' : 'Confirm Cancellation'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 py-2">
        {error && (
          <p className="text-xs text-danger font-medium">{error}</p>
        )}
        <label className="text-xs font-semibold text-text-secondary block">
          Cancellation Reason (Required for Audit Log)
        </label>
        <Textarea
          placeholder="State why this commercial quotation is being cancelled…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="h-20"
        />
      </div>
    </Dialog>
  );
};

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface DecisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decisionType: 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE';
  onConfirm: (reason?: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export const DecisionModal: React.FC<DecisionModalProps> = ({
  open,
  onOpenChange,
  decisionType,
  onConfirm,
  isLoading = false,
  errorMessage = null,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const displayError = error || errorMessage;

  const isReasonRequired = decisionType === 'REJECT' || decisionType === 'RETURN';

  const getTitle = () => {
    switch (decisionType) {
      case 'APPROVE':
        return 'Approve Quotation';
      case 'REJECT':
        return 'Reject Quotation';
      case 'RETURN':
        return 'Return Quotation for Revision';
      case 'ESCALATE':
        return 'Escalate to Higher Authority';
    }
  };

  const handleSubmit = () => {
    if (isReasonRequired && !reason.trim()) {
      setError(`A documented reason is mandatory when performing a ${decisionType.toLowerCase()} decision.`);
      return;
    }
    setError(null);
    onConfirm(reason);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={getTitle()}
      description="This governance action will update the approval state and unlock or lock Odoo transactions."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={
              decisionType === 'APPROVE'
                ? 'success'
                : decisionType === 'REJECT'
                ? 'danger'
                : 'warning'
            }
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Processing…' : `Confirm ${decisionType}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 py-2">
        {displayError && <p className="text-xs text-danger font-medium">{displayError}</p>}
        <label className="text-xs font-semibold text-text-secondary block">
          Explanation Note {isReasonRequired ? '(Mandatory)' : '(Optional)'}
        </label>
        <Textarea
          placeholder={
            isReasonRequired
              ? 'Detail the commercial justification or policy violation…'
              : 'Add any approver context or notes…'
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="h-24"
        />
      </div>
    </Dialog>
  );
};

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface AlertActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: 'NUDGE' | 'ESCALATE';
  alertTitle: string;
  onConfirm: (message?: string) => void;
  isLoading?: boolean;
}

export const AlertActionModal: React.FC<AlertActionModalProps> = ({
  open,
  onOpenChange,
  actionType,
  alertTitle,
  onConfirm,
  isLoading = false,
}) => {
  const [message, setMessage] = useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={actionType === 'NUDGE' ? 'Nudge Sales Representative' : 'Escalate to Sales Management'}
      description={`Target: ${alertTitle}`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={actionType === 'NUDGE' ? 'default' : 'danger'}
            onClick={() => onConfirm(message)}
            disabled={isLoading}
          >
            {isLoading ? 'Sending…' : `Send ${actionType === 'NUDGE' ? 'Nudge' : 'Escalation'}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 py-2 text-xs">
        <label className="font-semibold text-text-secondary block mb-1">
          Notification Message to Rep
        </label>
        <Textarea
          placeholder={
            actionType === 'NUDGE'
              ? 'e.g., Please check in with the customer regarding pending delivery terms…'
              : 'e.g., Escalating stalled deal to VP of Sales for executive sponsorship…'
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="h-20"
        />
      </div>
    </Dialog>
  );
};

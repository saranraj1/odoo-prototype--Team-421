import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bell, ArrowUpRight, UserCheck, ShieldAlert, ArrowRight } from 'lucide-react';

interface AlertActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: 'NUDGE' | 'ESCALATE';
  alertTitle: string;
  dealReference?: string;
  customerName?: string;
  onConfirm: (message?: string) => void;
  isLoading?: boolean;
}

export const AlertActionModal: React.FC<AlertActionModalProps> = ({
  open,
  onOpenChange,
  actionType,
  alertTitle,
  dealReference = 'Quotation',
  customerName = 'Customer',
  onConfirm,
  isLoading = false,
}) => {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) {
      setMessage(
        actionType === 'NUDGE'
          ? `Please check in with ${customerName} regarding stalled quotation ${dealReference}. Update the deal terms or re-engage procurement.`
          : `Escalating commercial exception on ${dealReference} (${customerName}) for executive governance review. Immediate sign-off required.`
      );
    }
  }, [open, actionType, dealReference, customerName]);

  const isNudge = actionType === 'NUDGE';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isNudge ? `Nudge Sales Representative: ${dealReference}` : `Escalate to Governance Authority: ${dealReference}`}
      description={`Issue: ${alertTitle}`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={isNudge ? 'default' : 'danger'}
            onClick={() => onConfirm(message)}
            disabled={isLoading}
            className="gap-1.5"
          >
            {isNudge ? <Bell className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
            {isLoading ? 'Dispatching…' : `Dispatch ${isNudge ? 'Nudge to Rep' : 'Governance Escalation'}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5 py-2 text-xs">
        {/* Routing Flow Visualizer */}
        <div className={`p-3 rounded-lg border ${
          isNudge
            ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800'
            : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-center justify-between font-semibold mb-1.5 text-text-primary">
            <span className="flex items-center gap-1.5">
              {isNudge ? (
                <UserCheck className="h-3.5 w-3.5 text-sky-600" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
              )}
              {isNudge ? 'Recipient: Sales Representative' : 'Recipient: Sales Manager & Finance Director'}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
              isNudge
                ? 'bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200'
                : 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200'
            }`}>
              {isNudge ? 'Role: SALES_REP' : 'Roles: SALES_MANAGER + FINANCE'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-text-secondary mt-1">
            <span>Management Console</span>
            <ArrowRight className="h-3 w-3 text-text-muted" />
            <span className="font-semibold text-text-primary">
              {isNudge ? 'Sales Rep Notification Bell & Action Queue' : 'Pending Approvals Queue & Executive Notification'}
            </span>
          </div>
        </div>

        <div>
          <label className="font-semibold text-text-secondary block mb-1">
            {isNudge ? 'Notification Message to Rep' : 'Escalation Reason & Notes'}
          </label>
          <Textarea
            placeholder={
              isNudge
                ? 'e.g., Please check in with the customer regarding pending delivery terms…'
                : 'e.g., Escalating discount anomaly to Finance Director for exception sign-off…'
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="h-20 text-xs"
          />
        </div>

        <p className="text-[11px] text-text-muted leading-relaxed">
          {isNudge
            ? 'ℹ️ The assigned sales rep will receive an immediate unread notification in their TopNav bell and a high-priority action card in their Control Tower.'
            : '⚠️ Escalating pushes this quotation directly into the commercial approval queue requiring Segregation of Duties sign-off from Sales Management and Finance.'}
        </p>
      </div>
    </Dialog>
  );
};


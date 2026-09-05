import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatMoney } from '@/lib/format';

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: number;
  amountDue: number;
  currency?: string;
  onConfirmPayment: (payload: { amount: number; journal_id?: number }) => void;
  isLoading?: boolean;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  open,
  onOpenChange,
  invoiceId,
  amountDue,
  currency = 'INR',
  onConfirmPayment,
  isLoading = false,
}) => {
  const [amount, setAmount] = useState<number>(amountDue || 558000);
  const [journalId, setJournalId] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    if (amount > amountDue) {
      setError(`Overpayment detected. Maximum allowable payment is ${formatMoney(amountDue, currency)}.`);
      return;
    }
    setError(null);
    onConfirmPayment({ amount, journal_id: journalId });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Record Payment for Invoice #${invoiceId}`}
      description="Register an account payment transaction against the selected Odoo invoice."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="success" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Registering…' : 'Register Payment'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
        {error && <p className="text-danger font-semibold">{error}</p>}

        <div>
          <label className="text-text-secondary font-semibold block mb-1">
            Payment Amount ({currency})
          </label>
          <Input
            type="number"
            step="0.01"
            min={0.01}
            max={amountDue}
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="h-8 tabular-nums font-bold text-sm"
          />
          <span className="text-[11px] text-text-muted mt-1 block">
            Outstanding Due: {formatMoney(amountDue, currency)}
          </span>
        </div>

        <div>
          <label className="text-text-secondary font-semibold block mb-1">
            Payment Journal / Bank Account
          </label>
          <Select
            value={journalId}
            onChange={(e) => setJournalId(Number(e.target.value))}
            className="h-8 text-xs"
          >
            <option value={1}>Bank / Wire Transfer (Odoo Journal #1)</option>
            <option value={2}>Corporate Card (Odoo Journal #2)</option>
            <option value={3}>Electronic Clearing (Odoo Journal #3)</option>
          </Select>
        </div>
      </form>
    </Dialog>
  );
};

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Send, Loader2 } from 'lucide-react';

interface CounterOfferFormProps {
  lines: Array<{ line_id: number; product_name: string; discount_pct: number }>;
  onSubmitRequest: (payload: {
    type: string;
    line_id?: number | null;
    requested_value?: number;
    message?: string;
  }) => void;
  isLoading?: boolean;
}

export const CounterOfferForm: React.FC<CounterOfferFormProps> = ({
  lines,
  onSubmitRequest,
  isLoading = false,
}) => {
  const [selectedLineId, setSelectedLineId] = useState<string>('all');
  const [counterDiscount, setCounterDiscount] = useState<number>(22);
  const [requestedDate, setRequestedDate] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lineIdNum = selectedLineId === 'all' ? null : Number(selectedLineId);
    let fullMessage = message;
    if (requestedDate) {
      fullMessage = `Requested delivery date: ${requestedDate}. ${message}`;
    }

    onSubmitRequest({
      type: 'COUNTER_DISCOUNT',
      line_id: lineIdNum,
      requested_value: counterDiscount,
      message: fullMessage,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-border bg-surface p-5">
      <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
        Submit Counter Proposal
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            Apply To Item
          </label>
          <Select
            value={selectedLineId}
            onChange={(e) => setSelectedLineId(e.target.value)}
            className="h-8 text-xs"
          >
            <option value="all">Entire Quotation</option>
            {lines.map((l) => (
              <option key={l.line_id} value={l.line_id}>
                {l.product_name} (Current: {l.discount_pct}%)
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            Target Counter Discount %
          </label>
          <div className="relative flex items-center">
            <Input
              type="number"
              min={0}
              max={100}
              required
              value={counterDiscount}
              onChange={(e) => setCounterDiscount(Number(e.target.value))}
              className="h-8 text-xs tabular-nums text-right pr-6"
            />
            <span className="absolute right-2 text-xs text-text-muted">%</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-text-secondary block mb-1">
            Requested Delivery Date
          </label>
          <Input
            type="date"
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-text-secondary block mb-1">
          Message to Sales Representative
        </label>
        <Textarea
          rows={2}
          placeholder="e.g., We are ready to sign immediately if Setup Service is adjusted to 22%…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="text-xs"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5 font-semibold">
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Submit Proposal
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

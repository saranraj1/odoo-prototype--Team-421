import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Send, Loader2, PackagePlus, Percent } from 'lucide-react';
import { MOCK_PRODUCTS } from '@/mocks/fixtures/products';

interface CounterOfferFormProps {
  lines: Array<{ line_id: number; product_name: string; discount_pct: number }>;
  onSubmitRequest: (payload: {
    type: string;
    line_id?: number | null;
    product_id?: number;
    product_name?: string;
    requested_qty?: number;
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
  const [proposalMode, setProposalMode] = useState<'discount' | 'amount' | 'add_item'>('discount');
  const [selectedLineId, setSelectedLineId] = useState<string>('all');
  const [counterDiscount, setCounterDiscount] = useState<number>(15);
  const [counterAmount, setCounterAmount] = useState<number>(500000);
  const [requestedDate, setRequestedDate] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<number>(MOCK_PRODUCTS[0]?.id || 101);
  const [requestedQty, setRequestedQty] = useState<number>(1);
  const [message, setMessage] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (proposalMode === 'add_item') {
      const prod = MOCK_PRODUCTS.find((p) => p.id === selectedProductId) || MOCK_PRODUCTS[0];
      onSubmitRequest({
        type: 'ADD_ITEM_REQUEST',
        product_id: prod.id,
        product_name: prod.name,
        requested_qty: requestedQty,
        requested_value: prod.list_price,
        message: message || `Customer requested adding ${requestedQty}x ${prod.name} from warehouse catalog.`,
      });
    } else if (proposalMode === 'amount') {
      onSubmitRequest({
        type: 'COUNTER_AMOUNT',
        requested_value: counterAmount,
        message: message || `Customer proposed a counter total of ₹${counterAmount.toLocaleString('en-IN')}.`,
      });
    } else {
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
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-border bg-surface p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
          Submit Customer Proposal
        </h3>
        <div className="flex items-center gap-1 rounded-input border border-border bg-elevated/40 p-0.5">
          <button
            type="button"
            onClick={() => setProposalMode('discount')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              proposalMode === 'discount'
                ? 'bg-brand text-brand-ink font-bold shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Percent className="h-3.5 w-3.5" />
            Discount %
          </button>
          <button
            type="button"
            onClick={() => setProposalMode('amount')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              proposalMode === 'amount'
                ? 'bg-brand text-brand-ink font-bold shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="text-[11px] font-bold">₹</span>
            Counter Amount
          </button>
          <button
            type="button"
            onClick={() => setProposalMode('add_item')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              proposalMode === 'add_item'
                ? 'bg-brand text-brand-ink font-bold shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Request Additional Items
          </button>
        </div>
      </div>

      {proposalMode === 'discount' ? (
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
      ) : proposalMode === 'amount' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Your Target Total Amount (₹)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-xs text-text-muted font-bold">₹</span>
              <Input
                type="number"
                min={1000}
                required
                value={counterAmount}
                onChange={(e) => setCounterAmount(Number(e.target.value))}
                className="h-8 text-xs tabular-nums pl-6"
              />
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              Enter the total amount you are willing to pay (excl. taxes).
            </p>
          </div>
          <div className="p-3 rounded-input bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
            <span className="font-semibold text-emerald-900 dark:text-emerald-200 block mb-1">What You're Proposing</span>
            <p className="text-emerald-700 dark:text-emerald-300">
              Counter total of <strong>₹{counterAmount.toLocaleString('en-IN')}</strong> — your sales representative will review and respond.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Select Product or Service from Warehouse Catalog
            </label>
            <Select
              value={String(selectedProductId)}
              onChange={(e) => setSelectedProductId(Number(e.target.value))}
              className="h-8 text-xs"
            >
              {MOCK_PRODUCTS.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.name} ({prod.category_name}) — ₹{prod.list_price.toLocaleString('en-IN')}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary block mb-1">
              Requested Quantity
            </label>
            <Input
              type="number"
              min={1}
              max={100}
              required
              value={requestedQty}
              onChange={(e) => setRequestedQty(Math.max(1, Number(e.target.value)))}
              className="h-8 text-xs tabular-nums"
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-text-secondary block mb-1">
          Proposal Notes to Sales Representative
        </label>
        <Textarea
          rows={2}
          placeholder={
            proposalMode === 'add_item'
              ? 'e.g., Please include this item with our deployment, if stock is available in warehouse…'
              : 'e.g., We are ready to sign immediately if Setup Service is adjusted to 15%…'
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="text-xs"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={isLoading}
          className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Submitting Proposal…
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Submit Proposal to Sales Rep
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

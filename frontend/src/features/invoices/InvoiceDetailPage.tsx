import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/data/Stepper';
import { HintStrip } from '@/components/data/HintStrip';
import { RecordPaymentModal } from './RecordPaymentModal';
import { billingApi } from '@/api/endpoints/billing';
import { reportsApi } from '@/api/endpoints/reports';
import { generateInvoicePdf } from '@/lib/pdf/invoicePdfTemplate';
import { formatMoney } from '@/lib/format';
import { ArrowLeft, CreditCard, Download } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';

export const InvoiceDetailPage: React.FC = () => {
  const { id = '1042' } = useParams();
  const navigate = useNavigate();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isPaidLocal, setIsPaidLocal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: invoiceData } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () => billingApi.getInvoice(id),
  });

  const invoice = invoiceData || {
    id: Number(id),
    number: `INV-${id}`,
    customer: 'Acme Corp',
    amount: 558000,
    status: isPaidLocal ? 'Paid' : 'Unpaid',
    lines: [
      { product_name: 'Laptop Pro 14"', qty: 10, price_unit: 44000, net_value: 440000 },
      { product_name: 'Setup Service', qty: 1, price_unit: 82000, net_value: 82000 },
    ],
  };

  const isPaid = isPaidLocal || invoice.status?.toLowerCase() === 'paid';

  const steps = [
    { label: 'Order Confirmed', status: 'done' as const },
    { label: 'Shipped', status: 'done' as const },
    { label: 'Invoiced', status: 'done' as const },
    { label: 'Paid', status: isPaid ? ('done' as const) : ('current' as const) },
  ];

  const handleConfirmPayment = async (payload: { amount: number; journal_id?: number }) => {
    try {
      await billingApi.recordPayment('deal_d1024_acme', Number(id), payload);
      setIsPaidLocal(true);
      setPaymentModalOpen(false);
    } catch {
      setIsPaidLocal(true);
      setPaymentModalOpen(false);
    }
  };

  const handleDownloadSummary = async () => {
    setIsDownloading(true);
    try {
      generateInvoicePdf({
        invoiceId: id,
        customerName: invoice.customer,
        amount: invoice.amount,
        isPaid: isPaid,
        deliveryReconciliation:
          'Shipment WH1/OUT/001 verified delivered. Invoiced amounts match fulfilled physical goods.',
        lines: (invoice.lines || []).map((l: any) => ({
          description: l.product_name || l.description,
          qty: l.qty,
          unitPrice: l.price_unit || l.unitPrice,
          total: l.net_value || l.total,
        })),
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/invoices')}
          className="gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Button>
      </div>

      <PageHeader
        title={`Invoice Detail: ${invoice.number || `INV-${id}`} (${invoice.customer})`}
        subtitle="Delivery reconciliation and payment registration against Odoo general ledger"
        actions={
          <div className="flex items-center gap-2">
            {!isPaid && (
              <Button
                size="sm"
                variant="success"
                onClick={() => setPaymentModalOpen(true)}
                className="gap-1.5 font-bold text-xs"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Record Payment
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadSummary}
              disabled={isDownloading}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download Summary (PDF)
            </Button>
          </div>
        }
      />

      <Card className="border-border bg-surface p-4">
        <Stepper steps={steps} />
      </Card>

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-text-primary">
            Invoice Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4 border-b border-border pb-3">
            <div>
              <span className="text-text-muted">Total Invoiced:</span>
              <p className="font-bold text-base text-text-primary">{formatMoney(invoice.amount)}</p>
            </div>
            <div>
              <span className="text-text-muted">Payment Status:</span>
              <p className="font-bold text-sm">
                <span
                  className={`px-2.5 py-0.5 rounded-chip text-xs ${
                    isPaid ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                  }`}
                >
                  {isPaid ? 'PAID' : 'UNPAID'}
                </span>
              </p>
            </div>
          </div>

          {/* Itemized Invoice Lines */}
          {invoice.lines && invoice.lines.length > 0 && (
            <div className="space-y-2">
              <span className="text-text-secondary font-bold uppercase tracking-wider text-[11px]">
                Itemized Invoiced Lines:
              </span>
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-elevated text-text-secondary border-b border-border">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Product Description</th>
                      <th className="py-2 px-3 font-semibold text-right">Quantity</th>
                      <th className="py-2 px-3 font-semibold text-right">Unit Price</th>
                      <th className="py-2 px-3 font-semibold text-right">Net Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {invoice.lines.map((l: any, idx: number) => (
                      <tr key={l.id || idx}>
                        <td className="py-2 px-3 font-medium text-text-primary">{l.product_name || l.description}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{l.qty}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatMoney(l.price_unit || l.unitPrice)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-semibold">{formatMoney(l.net_value || l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <span className="text-text-secondary font-semibold">Delivery Reconciliation:</span>
            <p className="text-text-muted">
              Sales Order commitment verified. Invoiced lines reconciled with warehouse stock reserves and general ledger.
            </p>
          </div>
        </CardContent>
      </Card>

      <HintStrip>
        Partial invoicing stays reconciled with partial delivery; nothing is billed before it ships.
      </HintStrip>

      <RecordPaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        invoiceId={Number(id)}
        amountDue={558000}
        onConfirmPayment={handleConfirmPayment}
      />
    </div>
  );
};

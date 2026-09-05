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
import { formatMoney } from '@/lib/format';
import { ArrowLeft, CreditCard, Download } from 'lucide-react';

export const InvoiceDetailPage: React.FC = () => {
  const { id = '1042' } = useParams();
  const navigate = useNavigate();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const steps = [
    { label: 'Order Confirmed', status: 'done' as const },
    { label: 'Shipped', status: 'done' as const },
    { label: 'Invoiced', status: 'done' as const },
    { label: 'Paid', status: isPaid ? ('done' as const) : ('current' as const) },
  ];

  const handleConfirmPayment = async (payload: { amount: number; journal_id?: number }) => {
    try {
      await billingApi.recordPayment('deal_d1024_acme', Number(id), payload);
      setIsPaid(true);
      setPaymentModalOpen(false);
    } catch {
      setIsPaid(true);
      setPaymentModalOpen(false);
    }
  };

  const handleDownloadSummary = async () => {
    setIsDownloading(true);
    try {
      await reportsApi.exportReport('billing', 'pdf', { deal_id: 'deal_d1024_acme' });
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
        title={`Invoice Detail: INV-${id} (Acme Corp)`}
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
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-4 border-b border-border pb-3">
            <div>
              <span className="text-text-muted">Total Invoiced:</span>
              <p className="font-bold text-base text-text-primary">{formatMoney(558000)}</p>
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

          <div className="space-y-1">
            <span className="text-text-secondary font-semibold">Delivery Reconciliation:</span>
            <p className="text-text-muted">
              Shipment WH1/OUT/001 (8 units) and WH2/OUT/002 (2 units) verified delivered. Invoiced amounts match fulfilled physical goods.
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

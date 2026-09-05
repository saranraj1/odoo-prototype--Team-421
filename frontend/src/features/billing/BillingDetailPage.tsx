import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HintStrip } from '@/components/data/HintStrip';
import { UpcomingScheduleTable } from './UpcomingScheduleTable';
import { dealsApi } from '@/api/endpoints/deals';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney } from '@/lib/format';
import { ODOO_URL } from '@/lib/constants';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';

export const BillingDetailPage: React.FC = () => {
  const { dealId = 'deal_d1024_acme' } = useParams();
  const navigate = useNavigate();

  const { data: workspace, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.deals.workspace(dealId),
    queryFn: () => dealsApi.getWorkspace(dealId),
  });

  const billing = workspace?.billing;
  const customer = workspace?.customer;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/subscriptions')}
          className="gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Subscriptions
        </Button>
      </div>

      <PageHeader
        title={`Billing Detail: ${customer?.name || 'Acme Corp'} – Monthly Gold Support`}
        subtitle="Segregated hybrid accounting: one-time commercial hardware and recurring Odoo subscriptions"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`${ODOO_URL}/web#model=sale.order`, '_blank')}
              className="gap-1 text-xs"
            >
              <span>Modify in Odoo</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => window.open(`${ODOO_URL}/web#model=sale.order`, '_blank')}
              className="gap-1 text-xs"
            >
              Cancel Subscription
            </Button>
          </div>
        }
      />

      {/* One-Time Lines Table */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-info uppercase tracking-wider">
            One-Time Lines (From Originating Order)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-text-secondary border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Product Description</th>
                  <th className="py-2.5 px-4 font-semibold text-center w-24">Qty</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Invoiced Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {billing?.one_time_lines.map((ot: any, idx: number) => (
                  <tr key={idx} className="hover:bg-elevated/30">
                    <td className="py-2.5 px-4 font-medium text-text-primary">{ot.product_name}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">{ot.qty}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-bold text-text-primary">
                      {formatMoney(ot.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recurring Lines & Schedule */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-info uppercase tracking-wider">
            Recurring Lines &amp; Upcoming Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-text-secondary border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Plan Name</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Billing Cycle</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Next Bill Date</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Cadence Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {billing?.recurring_lines.map((rec: any, idx: number) => (
                  <tr key={idx} className="hover:bg-elevated/30">
                    <td className="py-2.5 px-4 font-semibold text-text-primary">{rec.product_name} · {rec.plan_name}</td>
                    <td className="py-2.5 px-4 text-center">{rec.cadence}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">{rec.next_bill_date}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-bold text-brand">{formatMoney(rec.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2">
            <span className="text-xs font-semibold text-text-secondary block mb-1">
              Upcoming Projected Billing Schedule:
            </span>
            <UpcomingScheduleTable schedule={billing?.subscriptions[0]?.schedule || []} />
          </div>
        </CardContent>
      </Card>

      <HintStrip>
        Recurring lines are billed by Odoo Subscriptions; one-time lines are invoiced once. Both are shown separately here.
      </HintStrip>
    </div>
  );
};

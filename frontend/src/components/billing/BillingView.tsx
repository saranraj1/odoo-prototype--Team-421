import React from 'react';
import { useDealFlow } from '../../app/providers/DealFlowContext';
import { Badge, Card } from '../ui';
import { CreditCard, Calendar, CheckCircle2, Clock, DollarSign, Repeat } from 'lucide-react';

export const BillingView: React.FC = () => {
  const { activeDeal } = useDealFlow();

  const oneTimeLines = activeDeal.lines.filter((l) => !l.isSubscription);
  const recurringLines = activeDeal.lines.filter((l) => l.isSubscription);

  const oneTimeTotal = oneTimeLines.reduce((sum, l) => {
    const net = l.unitPrice * l.quantity * (1 - l.discountPercent / 100);
    return sum + net;
  }, 0);

  const monthlyRecurringTotal = recurringLines.reduce((sum, l) => {
    const unitNet = l.unitPrice * (1 - l.discountPercent / 100);
    return sum + unitNet;
  }, 0);

  // Generate upcoming 6-month billing schedule
  const upcomingInvoices = [
    { date: '01 Oct 2026', amount: Math.round(monthlyRecurringTotal), status: 'Queued in Odoo' },
    { date: '01 Nov 2026', amount: Math.round(monthlyRecurringTotal), status: 'Scheduled' },
    { date: '01 Dec 2026', amount: Math.round(monthlyRecurringTotal), status: 'Scheduled' },
    { date: '01 Jan 2027', amount: Math.round(monthlyRecurringTotal), status: 'Scheduled' },
    { date: '01 Feb 2027', amount: Math.round(monthlyRecurringTotal), status: 'Scheduled' },
    { date: '01 Mar 2027', amount: Math.round(monthlyRecurringTotal), status: 'Scheduled' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-brand-600" />
          Commercial Billing &amp; Subscription Schedule
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Dual-track billing lifecycle management separating one-time capital charges from recurring subscription schedules
        </p>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <span className="text-xs font-semibold uppercase text-slate-500 block">Total One-Time Capital</span>
          <div className="text-xl font-black font-mono text-slate-900 mt-1 tabular-nums">
            ₹{Math.round(oneTimeTotal).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Due on order confirmation (Net 30)</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold uppercase text-slate-500 block">Monthly Recurring (MRR)</span>
          <div className="text-xl font-black font-mono text-brand-700 mt-1 tabular-nums">
            ₹{Math.round(monthlyRecurringTotal).toLocaleString('en-IN')} / mo
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">24/7 SLA Support Subscription</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold uppercase text-slate-500 block">Next Invoice Date</span>
          <div className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>01 Oct 2026</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Automated Odoo recurring invoice</span>
        </Card>
      </div>

      {/* Dual Column: One-Time vs Recurring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* One-Time Billing Deliverables */}
        <Card className="p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                One-Time Hardware &amp; Services
              </h3>
              <span className="text-xs text-slate-500">Upfront invoiced deliverables</span>
            </div>
            <Badge variant="neutral">One-Time</Badge>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {oneTimeLines.map((line) => {
              const net = line.unitPrice * line.quantity * (1 - line.discountPercent / 100);
              return (
                <div key={line.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900 block">{line.name}</span>
                    <span className="text-slate-400 text-[11px]">
                      Qty: {line.quantity} · Discount: {line.discountPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                    ₹{Math.round(net).toLocaleString('en-IN')}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs font-bold">
            <span className="text-slate-700">One-Time Invoiced Subtotal:</span>
            <span className="font-mono text-slate-900 text-sm">
              ₹{Math.round(oneTimeTotal).toLocaleString('en-IN')}
            </span>
          </div>
        </Card>

        {/* Recurring Subscriptions & Upcoming Schedule */}
        <Card className="p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Recurring SLA Subscriptions
              </h3>
              <span className="text-xs text-slate-500">Continuous monthly operational billing</span>
            </div>
            <Badge variant="purple" size="sm">Recurring</Badge>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {recurringLines.map((line) => {
              const netPerMonth = line.unitPrice * (1 - line.discountPercent / 100);
              return (
                <div key={line.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900 block">{line.name}</span>
                    <span className="text-slate-400 text-[11px]">
                      Billing Cycle: Monthly · Commitment: {line.quantity} months
                    </span>
                  </div>
                  <div className="font-mono font-bold text-brand-700 text-sm tabular-nums">
                    ₹{Math.round(netPerMonth).toLocaleString('en-IN')} / mo
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upcoming Schedule Table */}
          <div className="mt-4 pt-3 border-t border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Upcoming Billing Cycle
            </span>

            <div className="space-y-1.5 text-xs">
              {upcomingInvoices.map((inv, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50/70 border border-slate-100">
                  <span className="font-medium text-slate-700">{inv.date}</span>
                  <span className="font-mono font-semibold text-slate-900">
                    ₹{inv.amount.toLocaleString('en-IN')}
                  </span>
                  <Badge variant="neutral" size="sm">
                    {inv.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

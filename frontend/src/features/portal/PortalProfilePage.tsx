import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { KpiCard } from '@/components/data/KpiCard';
import { usePortalAuthStore } from './portalAuthStore';
import { formatMoney, formatAbsoluteDate } from '@/lib/format';
import {
  Building2,
  LogOut,
  Package,
  Calendar,
  CreditCard,
  Truck,
  FileText,
  ExternalLink,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ACME_CUSTOMER_PROFILE,
  ACME_SPEND_OVER_TIME,
  ACME_HISTORICAL_ORDERS,
  CustomerHistoricalOrder,
} from './data/customerHistory';

export const PortalProfilePage: React.FC = () => {
  const { partner, clearAuth } = usePortalAuthStore();
  const navigate = useNavigate();

  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeOrderModal, setActiveOrderModal] = useState<CustomerHistoricalOrder | null>(null);

  const profile = ACME_CUSTOMER_PROFILE;

  const handleLogout = () => {
    clearAuth();
    navigate('/portal/login');
  };

  // Filter orders based on period, status, and query
  const filteredOrders = useMemo(() => {
    return ACME_HISTORICAL_ORDERS.filter((order) => {
      // Period filter
      if (selectedPeriod === '2026' && order.year !== 2026) return false;
      if (selectedPeriod === '2025' && order.year !== 2025) return false;
      if (selectedPeriod === 'last_6m') {
        const orderDate = new Date(order.date);
        const cutoff = new Date('2026-03-01');
        if (orderDate < cutoff) return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && order.status !== selectedStatus) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesRef = order.orderNumber.toLowerCase().includes(query);
        const matchesOdoo = order.odooReference.toLowerCase().includes(query);
        const matchesItem = order.items.some((item) => item.name.toLowerCase().includes(query));
        if (!matchesRef && !matchesOdoo && !matchesItem) return false;
      }

      return true;
    });
  }, [selectedPeriod, selectedStatus, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Customer Account & Order History"
        subtitle="Review your lifetime order trends, past shipments, contracts, and organization details"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-1.5 text-xs text-danger hover:bg-rose-50 hover:border-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out of Portal
          </Button>
        }
      />

      {/* Account Profile & Corporate Terms Bar */}
      <Card className="border-border bg-surface">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-text-primary">
                    {partner?.name || profile.name}
                  </h2>
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                    {profile.tierCode} TIER
                  </span>
                  <span className="text-[11px] font-mono text-text-muted bg-elevated px-2 py-0.5 rounded border border-border">
                    ID #{partner?.id || profile.partnerId}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {profile.tierDescription} · Partner since Q4 2025
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-5">
              <div>
                <span className="text-[11px] text-text-muted block">Primary Email</span>
                <span className="font-semibold text-text-primary">{profile.email}</span>
              </div>
              <div>
                <span className="text-[11px] text-text-muted block">Payment Terms</span>
                <span className="font-semibold text-text-primary">{profile.paymentTerms}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[11px] text-text-muted block">Assigned Warehouse</span>
                <span className="font-semibold text-text-primary truncate block">{profile.shippingWarehouse}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 4 Lifetime Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          title="Lifetime Spend"
          value={formatMoney(profile.lifetimeSpend, 'INR', 0)}
          caption="Total purchases over partnership"
        />
        <KpiCard
          title="Total Orders Placed"
          value={`${profile.totalOrders} Orders`}
          caption="4 fulfilled or in active review"
        />
        <KpiCard
          title="Active Contracts"
          value={`${profile.activeContracts} Subscription`}
          caption="Monthly Gold Support active"
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          title="Avg Order Value"
          value={formatMoney(profile.avgOrderValue, 'INR', 0)}
          caption="Per order transaction size"
        />
      </div>

      {/* Visual Analytics: Order Spend Over Time */}
      <div className="rounded-card border border-border bg-surface p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Order Spend Over Time (Quarterly Volume)
            </h3>
            <p className="text-xs text-text-secondary">
              Chronological breakdown of commercial orders placed with DealFlow360
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full self-start sm:self-auto">
            100% On-Time Fulfillment SLA
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ACME_SPEND_OVER_TIME}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="period" stroke="#64748B" fontSize={11} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                tickFormatter={(val) => `₹${val >= 100000 ? `${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 1)}L` : val}`}
              />
              <Tooltip
                formatter={(val: any, _name: any, item: any) => [
                  `${formatMoney(Number(val) || 0)} (${item.payload.units} units)`,
                  item.payload.label,
                ]}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#F8FAFC',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar dataKey="spend" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Orders Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Historical Orders &amp; Past Shipments
            </h3>
            <p className="text-xs text-text-secondary">
              Showing {filteredOrders.length} of {ACME_HISTORICAL_ORDERS.length} historical transactions
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-36">
              <Select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="h-8 text-xs"
              >
                <option value="all">All Time</option>
                <option value="2026">2026 Orders</option>
                <option value="last_6m">Last 6 Months</option>
                <option value="2025">2025 Orders</option>
              </Select>
            </div>

            <div className="w-36">
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-8 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="DELIVERED">Delivered</option>
                <option value="COMPLETED">Fulfilled & Closed</option>
                <option value="NEGOTIATION">Under Negotiation</option>
              </Select>
            </div>

            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <Input
                placeholder="Search orders or items…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="rounded-card border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-elevated text-text-secondary border-b border-border uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Date &amp; Period</th>
                  <th className="py-3 px-4">Items Ordered</th>
                  <th className="py-3 px-4 text-right">Order Value</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Documents</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">
                      No past orders match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-elevated/40 transition-colors">
                      {/* Order Reference */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-text-primary">{order.orderNumber}</span>
                          <span className="text-[10px] font-mono bg-elevated px-1.5 py-0.2 rounded border border-border text-text-muted">
                            {order.odooReference}
                          </span>
                        </div>
                      </td>

                      {/* Date & Period */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-text-primary block">
                          {formatAbsoluteDate(order.date)}
                        </span>
                        <span className="text-[11px] text-text-muted font-mono">{order.quarter}</span>
                      </td>

                      {/* Items Ordered */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex flex-wrap gap-1">
                          {order.items.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium"
                            >
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {item.quantity}×
                              </span>
                              {item.name}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-text-primary whitespace-nowrap text-sm">
                        {formatMoney(order.total, order.currency)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            order.status === 'DELIVERED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : order.status === 'COMPLETED'
                              ? 'bg-slate-100 text-slate-700 border border-slate-300'
                              : 'bg-amber-50 text-amber-700 border border-amber-300'
                          }`}
                        >
                          {order.statusLabel}
                        </span>
                      </td>

                      {/* Documents / Invoices */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {order.invoiceNumber ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-text-secondary bg-elevated px-2 py-0.5 rounded border border-border">
                            <Receipt className="h-3 w-3 text-emerald-600" />
                            {order.invoiceNumber}
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-muted italic">Draft / Pending</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setActiveOrderModal(order)}
                          >
                            <FileText className="h-3 w-3" />
                            Breakdown
                          </Button>
                          {order.id === 'deal_d1024_acme' && (
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => navigate(`/portal/quotations/${order.id}`)}
                            >
                              <span>Negotiate</span>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Order Itemized Receipt Dialog */}
      {activeOrderModal && (
        <Dialog
          open={Boolean(activeOrderModal)}
          onOpenChange={(open) => {
            if (!open) setActiveOrderModal(null);
          }}
          title={`Order Breakdown: ${activeOrderModal.orderNumber} (${activeOrderModal.odooReference})`}
          description={`Purchased on ${formatAbsoluteDate(activeOrderModal.date)} · ${activeOrderModal.quarter}`}
          footer={
            <div className="flex items-center gap-2">
              {activeOrderModal.id === 'deal_d1024_acme' ? (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={() => {
                    setActiveOrderModal(null);
                    navigate(`/portal/quotations/${activeOrderModal.id}`);
                  }}
                >
                  <span>Open Active Quotation</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveOrderModal(null)}
                >
                  Close Receipt
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Fulfillment & Warehouse Information */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-border">
              <div>
                <span className="text-[11px] text-text-muted block">Fulfillment Warehouse</span>
                <span className="font-semibold text-text-primary">{activeOrderModal.deliveryWarehouse}</span>
              </div>
              <div>
                <span className="text-[11px] text-text-muted block">Tracking / Logistics Status</span>
                <span className="font-mono font-medium text-text-primary">{activeOrderModal.trackingNumber}</span>
              </div>
            </div>

            {/* Line Items List */}
            <div className="rounded-card border border-border overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-elevated text-text-secondary border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Item</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-16">Qty</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Unit Price</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-20">Discount</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {activeOrderModal.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 px-3 font-medium text-text-primary">{item.name}</td>
                      <td className="py-2 px-3 text-center tabular-nums">{item.quantity}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-text-secondary">
                        {formatMoney(item.unitPrice, activeOrderModal.currency)}
                      </td>
                      <td className="py-2 px-3 text-center tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                        {item.discountPct}%
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-text-primary">
                        {formatMoney(item.total, activeOrderModal.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal:</span>
                  <span className="tabular-nums font-medium">
                    {formatMoney(activeOrderModal.subtotal, activeOrderModal.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Taxes:</span>
                  <span className="tabular-nums font-medium">
                    {formatMoney(activeOrderModal.tax, activeOrderModal.currency)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-sm text-text-primary border-t border-border pt-1.5">
                  <span>Order Total:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatMoney(activeOrderModal.total, activeOrderModal.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

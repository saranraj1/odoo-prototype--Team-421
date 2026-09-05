import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/data/KpiCard';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { ReportFilters } from './components/ReportFilters';
import { Button } from '@/components/ui/button';
import { reportsApi } from '@/api/endpoints/reports';
import { formatMoney } from '@/lib/format';
import { Download, FileSpreadsheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState('month');
  const [approvalStatus, setApprovalStatus] = useState('all');
  const [activeTab, setActiveTab] = useState<'deals' | 'approvals' | 'discounts' | 'risk' | 'products' | 'fulfillment' | 'billing'>('deals');

  const handleExport = (format: 'pdf' | 'xlsx') => {
    reportsApi.exportReport(activeTab, format, { period, approval_status: approvalStatus });
  };

  const dealsRows = [
    { ref: 'D-1024', customer: 'Acme Corp', rep: 'Sales Rep One', amount: 558000, margin: '19.3%', risk: 56.0, status: 'Draft' },
    { ref: 'D-1023', customer: 'Beta Industries', rep: 'Sales Rep Two', amount: 420000, margin: '22.0%', risk: 29.7, status: 'Approved' },
  ];

  const columns: ColumnDef<any>[] = [
    { key: 'ref', header: 'Reference', render: (d) => <span className="font-bold text-text-primary">{d.ref}</span> },
    { key: 'customer', header: 'Customer' },
    { key: 'rep', header: 'Sales Rep' },
    { key: 'amount', header: 'Order Amount', className: 'text-right', render: (d) => <span className="tabular-nums font-semibold">{formatMoney(d.amount)}</span> },
    { key: 'margin', header: 'Blended Margin', className: 'text-right' },
    { key: 'risk', header: 'Risk Score', className: 'text-center font-bold text-danger' },
    { key: 'status', header: 'Status' },
  ];

  const approvalTurnaroundData = [
    { stage: 'Sales Manager', hours: 4.2 },
    { stage: 'Finance', hours: 8.6 },
    { stage: 'Overall Turnaround', hours: 6.4 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin / Reporting Dashboard"
        subtitle="Comprehensive BI analytics, turnaround metrics, and executive regulatory exports"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleExport('pdf')} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExport('xlsx')} className="gap-1.5 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export XLS
            </Button>
          </div>
        }
      />

      <ReportFilters
        period={period}
        onPeriodChange={setPeriod}
        approvalStatus={approvalStatus}
        onApprovalStatusChange={setApprovalStatus}
      />

      {/* 3 Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Quotes Created" value="18" caption="Total evaluated by Deal Guardian" />
        <KpiCard title="Avg Approval Time" value="6.4 hours" caption="Median SLA turnaround" />
        <KpiCard title="Top Upsold Product" value="Docking Station" caption="+₹98,000 incremental margin generated" />
      </div>

      {/* Tab Selectors */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto">
        {(['deals', 'approvals', 'discounts', 'risk', 'products', 'fulfillment', 'billing'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 text-xs font-semibold capitalize rounded-md transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-text-muted hover:text-text-primary hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            {tab} Report
          </button>
        ))}
      </div>

      {/* Chart & Table */}
      <div className="space-y-4">
        {activeTab === 'approvals' && (
          <div className="rounded-card border border-border bg-surface p-5">
            <h4 className="text-xs font-bold text-text-secondary uppercase mb-4">
              Approval Turnaround by Stage (Hours)
            </h4>
            <div className="h-48 w-full max-w-lg">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={approvalTurnaroundData}>
                  <XAxis dataKey="stage" stroke="#64748B" fontSize={11} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} unit="h" />
                  <Tooltip
                    formatter={(val: any) => [`${val} hrs`, 'Turnaround']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="hours" fill="#0284C7" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <DataTable data={dealsRows} columns={columns} />
      </div>
    </div>
  );
};

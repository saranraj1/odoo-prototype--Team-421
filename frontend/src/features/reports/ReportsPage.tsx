import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/data/KpiCard';
import { DataTable, ColumnDef } from '@/components/data/DataTable';
import { ReportFilters } from './components/ReportFilters';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { exportReportToPdf, exportReportToXls, ReportColumnConfig } from '@/lib/export/reportExport';
import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export type ReportTab = 'deals' | 'approvals' | 'discounts' | 'risk' | 'products' | 'fulfillment' | 'billing';

export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState('month');
  const [team, setTeam] = useState('all');
  const [approvalStatus, setApprovalStatus] = useState('all');
  const [productFilter, setProductFilter] = useState('');
  const [activeTab, setActiveTab] = useState<ReportTab>('deals');
  const [isExporting, setIsExporting] = useState<'pdf' | 'xlsx' | null>(null);

  // 1. Deals Dataset
  const dealsData = useMemo(() => [
    { id: '1', ref: 'D-1024', customer: 'Acme Corp', rep: 'Sales Rep One', team: '1', team_name: 'North Team', amount: 558000, margin: '19.3%', risk: 56.0, status: 'Draft' },
    { id: '2', ref: 'D-1023', customer: 'Beta Industries', rep: 'Sales Rep Two', team: '2', team_name: 'South Team', amount: 420000, margin: '22.0%', risk: 29.7, status: 'Approved' },
    { id: '3', ref: 'D-1021', customer: 'Delta Systems Inc', rep: 'Sales Rep One', team: '1', team_name: 'North Team', amount: 780000, margin: '18.5%', risk: 44.5, status: 'Pending Approval' },
    { id: '4', ref: 'D-1022', customer: 'Gamma LLC', rep: 'Sales Rep One', team: '1', team_name: 'North Team', amount: 92000, margin: '28.0%', risk: 24.0, status: 'Draft' },
    { id: '5', ref: 'D-1019', customer: 'Gamma LLC', rep: 'Sales Rep Two', team: '2', team_name: 'South Team', amount: 310000, margin: '21.0%', risk: 38.0, status: 'Returned' },
    { id: '6', ref: 'D-1018', customer: 'Zeta Tech', rep: 'Sales Rep Two', team: '2', team_name: 'South Team', amount: 450000, margin: '31.0%', risk: 14.2, status: 'Approved' },
    { id: '7', ref: 'D-1015', customer: 'Omega Global', rep: 'Sales Rep One', team: '1', team_name: 'North Team', amount: 280000, margin: '26.4%', risk: 18.0, status: 'Approved' },
    { id: '8', ref: 'D-1012', customer: 'Alpha Logistics', rep: 'Sales Rep One', team: '1', team_name: 'North Team', amount: 360000, margin: '23.5%', risk: 22.5, status: 'Approved' },
  ], []);

  // 2. Approvals Dataset
  const approvalsData = useMemo(() => [
    { id: '1', ref: 'D-1024', customer: 'Acme Corp', stage: 'Sales Manager', assigned_to: 'Sunita Sales Manager North', team: '1', amount: 558000, wait_hours: 4.2, sla_status: 'On Track', status: 'Pending' },
    { id: '2', ref: 'D-1023', customer: 'Beta Industries', stage: 'Sales Manager', assigned_to: 'Sales Manager South', team: '2', amount: 420000, wait_hours: 3.1, sla_status: 'On Track', status: 'Pending' },
    { id: '3', ref: 'D-1021', customer: 'Delta Systems Inc', stage: 'Finance', assigned_to: 'Vikram Finance Officer', team: '1', amount: 780000, wait_hours: 8.6, sla_status: 'Warning', status: 'Pending' },
    { id: '4', ref: 'D-1019', customer: 'Gamma LLC', stage: 'Sales Manager', assigned_to: 'Sunita Sales Manager North', team: '1', amount: 310000, wait_hours: 12.0, sla_status: 'Returned', status: 'Returned' },
    { id: '5', ref: 'D-1018', customer: 'Zeta Tech', stage: 'Finance', assigned_to: 'Vikram Finance Officer', team: '2', amount: 450000, wait_hours: 2.4, sla_status: 'Completed', status: 'Approved' },
    { id: '6', ref: 'D-1015', customer: 'Omega Global', stage: 'Sales Manager', assigned_to: 'Sunita Sales Manager North', team: '1', amount: 280000, wait_hours: 1.8, sla_status: 'Completed', status: 'Approved' },
  ], []);

  // 3. Discounts Dataset (Requested by user: "from discount reports isnt workig")
  const discountsData = useMemo(() => [
    { id: '1', deal_ref: 'D-1024', customer: 'Acme Corp', product: 'Enterprise Laptop Pro 14"', category: 'Hardware', list_price: 440000, discount_pct: 20.0, policy_limit: 12.0, variance: '+8.0%', compliance: 'Policy Violation', status: 'Pending', team: '1' },
    { id: '2', deal_ref: 'D-1024', customer: 'Acme Corp', product: 'Setup & Deployment Service', category: 'Services', list_price: 118000, discount_pct: 8.0, policy_limit: 10.0, variance: '-2.0%', compliance: 'Within Policy', status: 'Pending', team: '1' },
    { id: '3', deal_ref: 'D-1023', customer: 'Beta Industries', product: 'Cloud Server Appliance X1', category: 'Hardware', list_price: 350000, discount_pct: 22.0, policy_limit: 12.0, variance: '+10.0%', compliance: 'Policy Violation', status: 'Pending', team: '2' },
    { id: '4', deal_ref: 'D-1021', customer: 'Delta Systems Inc', product: 'Unified ERP Connector', category: 'Software', list_price: 650000, discount_pct: 15.0, policy_limit: 15.0, variance: '0.0%', compliance: 'At Threshold', status: 'Pending', team: '1' },
    { id: '5', deal_ref: 'D-1022', customer: 'Gamma LLC', product: 'Annual Maintenance Pack', category: 'Services', list_price: 92000, discount_pct: 5.0, policy_limit: 10.0, variance: '-5.0%', compliance: 'Within Policy', status: 'Draft', team: '1' },
    { id: '6', deal_ref: 'D-1018', customer: 'Zeta Tech', product: 'Docking Station Hub Pro', category: 'Hardware', list_price: 210000, discount_pct: 7.5, policy_limit: 12.0, variance: '-4.5%', compliance: 'Within Policy', status: 'Approved', team: '2' },
    { id: '7', deal_ref: 'D-1015', customer: 'Omega Global', product: 'Enterprise Laptop Pro 14"', category: 'Hardware', list_price: 280000, discount_pct: 10.0, policy_limit: 12.0, variance: '-2.0%', compliance: 'Within Policy', status: 'Approved', team: '1' },
  ], []);

  // 4. Risk Dataset
  const riskData = useMemo(() => [
    { id: '1', ref: 'D-1024', customer: 'Acme Corp', risk_score: 56.0, severity: 'HIGH', driver: 'Discount Outlier (20%) + Multi-WH Split', margin: '19.3%', action: 'Manager + Finance Signoff', status: 'Pending', team: '1' },
    { id: '2', ref: 'D-1023', customer: 'Beta Industries', risk_score: 29.7, severity: 'MEDIUM', driver: 'Excessive Discount (22%)', margin: '22.0%', action: 'Manager Review', status: 'Pending', team: '2' },
    { id: '3', ref: 'D-1021', customer: 'Delta Systems Inc', risk_score: 44.5, severity: 'MEDIUM', driver: 'High Transaction Exposure (>₹7.5L)', margin: '18.5%', action: 'Finance Signoff', status: 'Pending', team: '1' },
    { id: '4', ref: 'D-1022', customer: 'Gamma LLC', risk_score: 24.0, severity: 'LOW', driver: 'Quotation Inactivity (12 Days)', margin: '28.0%', action: 'Sales Rep Follow-up', status: 'Draft', team: '1' },
    { id: '5', ref: 'D-1019', customer: 'Gamma LLC', risk_score: 38.0, severity: 'MEDIUM', driver: 'Credit Terms Variance (Net-60)', margin: '21.0%', action: 'Returned for Revision', status: 'Returned', team: '1' },
    { id: '6', ref: 'D-1018', customer: 'Zeta Tech', risk_score: 14.2, severity: 'LOW', driver: 'Standard Terms & Tier Silver Compliant', margin: '31.0%', action: 'Autonomous Approval', status: 'Approved', team: '2' },
  ], []);

  // 5. Products Dataset
  const productsData = useMemo(() => [
    { id: '1', sku: 'PRD-101', name: 'Enterprise Laptop Pro 14"', category: 'Hardware', list_price: 44000, cost_price: 32000, units: 28, total_revenue: 1232000, margin: '27.2%', discount_cap: '12.0%', status: 'Approved', team: 'all' },
    { id: '2', sku: 'PRD-102', name: 'Docking Station Hub Pro', category: 'Hardware', list_price: 14000, cost_price: 8500, units: 45, total_revenue: 630000, margin: '39.3%', discount_cap: '15.0%', status: 'Approved', team: 'all' },
    { id: '3', sku: 'PRD-103', name: 'Setup & Deployment Service', category: 'Services', list_price: 82000, cost_price: 45000, units: 6, total_revenue: 492000, margin: '45.1%', discount_cap: '10.0%', status: 'Approved', team: 'all' },
    { id: '4', sku: 'PRD-104', name: 'Cloud ERP Integration Connector', category: 'Software', list_price: 120000, cost_price: 20000, units: 8, total_revenue: 960000, margin: '83.3%', discount_cap: '20.0%', status: 'Approved', team: 'all' },
    { id: '5', sku: 'PRD-105', name: 'Annual 24/7 SLA Maintenance', category: 'Services', list_price: 92000, cost_price: 50000, units: 12, total_revenue: 1104000, margin: '45.6%', discount_cap: '10.0%', status: 'Approved', team: 'all' },
  ], []);

  // 6. Fulfillment Dataset
  const fulfillmentData = useMemo(() => [
    { id: '1', order_ref: 'D-1024', customer: 'Acme Corp', split: 'WH1 Central (8 units) + WH2 Regional (2 units)', strategy: 'Multi-Warehouse Split', delivery_status: 'Delivered', reconciliation: '100% Verified', status: 'Approved', team: '1' },
    { id: '2', order_ref: 'D-1023', customer: 'Beta Industries', split: 'Bangalore Logistics Hub (5 units)', strategy: 'Direct Dispatch', delivery_status: 'In Transit', reconciliation: 'Pending POD', status: 'Pending', team: '2' },
    { id: '3', order_ref: 'D-1021', customer: 'Delta Systems Inc', split: 'Delhi Central Depot (12 units)', strategy: 'Direct Dispatch', delivery_status: 'Allocated', reconciliation: 'Stock Reserved', status: 'Pending', team: '1' },
    { id: '4', order_ref: 'D-1018', customer: 'Zeta Tech', split: 'Mumbai WH1 (4 units)', strategy: 'Direct Dispatch', delivery_status: 'Delivered', reconciliation: '100% Verified', status: 'Approved', team: '2' },
    { id: '5', order_ref: 'D-1015', customer: 'Omega Global', split: 'Chennai WH (3 units)', strategy: 'Direct Dispatch', delivery_status: 'Delivered', reconciliation: '100% Verified', status: 'Approved', team: '1' },
  ], []);

  // 7. Billing Dataset
  const billingData = useMemo(() => [
    { id: '1', inv_no: 'INV-1042', order_ref: 'D-1024', customer: 'Acme Corp', amount: 558000, paid_amount: 0, due_date: '2026-10-05', reconciliation: 'Verified (WH1 & WH2)', status: 'Unpaid', team: '1' },
    { id: '2', inv_no: 'INV-1043', order_ref: 'D-1023', customer: 'Beta Industries', amount: 420000, paid_amount: 420000, due_date: '2026-09-01', reconciliation: 'Verified Full', status: 'Paid', team: '2' },
    { id: '3', inv_no: 'INV-1044', order_ref: 'D-1021', customer: 'Delta Systems Inc', amount: 780000, paid_amount: 780000, due_date: '2026-09-15', reconciliation: 'Verified Central', status: 'Paid', team: '1' },
    { id: '4', inv_no: 'INV-1045', order_ref: 'D-1019', customer: 'Gamma LLC', amount: 310000, paid_amount: 0, due_date: '2026-08-20', reconciliation: 'Hold (Pending Return)', status: 'Overdue', team: '1' },
    { id: '5', inv_no: 'INV-1046', order_ref: 'D-1018', customer: 'Zeta Tech', amount: 450000, paid_amount: 450000, due_date: '2026-09-10', reconciliation: 'Verified Full', status: 'Paid', team: '2' },
  ], []);

  // Master Filtering Function
  const filterRows = <T extends Record<string, any>>(rawRows: T[]): T[] => {
    return rawRows.filter((item) => {
      // 1. Team Filter
      if (team !== 'all' && item.team && item.team !== 'all') {
        if (item.team !== team) return false;
      }

      // 2. Approval Status Filter
      if (approvalStatus !== 'all') {
        const itemStatus = String(item.status || item.compliance || '').toLowerCase();
        if (approvalStatus === 'pending') {
          if (!['pending', 'draft', 'pending approval', 'unpaid', 'allocated', 'in transit'].some((s) => itemStatus.includes(s))) {
            return false;
          }
        } else if (approvalStatus === 'approved') {
          if (!['approved', 'paid', 'delivered', 'within policy', 'completed'].some((s) => itemStatus.includes(s))) {
            return false;
          }
        } else if (approvalStatus === 'rejected') {
          if (!['rejected', 'returned', 'overdue', 'policy violation', 'warning'].some((s) => itemStatus.includes(s))) {
            return false;
          }
        }
      }

      // 3. Product / Query Filter
      if (productFilter.trim()) {
        const query = productFilter.toLowerCase().trim();
        const matches = Object.values(item).some((val) =>
          String(val ?? '').toLowerCase().includes(query)
        );
        if (!matches) return false;
      }

      return true;
    });
  };

  // Filtered Datasets for each tab
  const filteredDeals = useMemo(() => filterRows(dealsData), [dealsData, team, approvalStatus, productFilter]);
  const filteredApprovals = useMemo(() => filterRows(approvalsData), [approvalsData, team, approvalStatus, productFilter]);
  const filteredDiscounts = useMemo(() => filterRows(discountsData), [discountsData, team, approvalStatus, productFilter]);
  const filteredRisk = useMemo(() => filterRows(riskData), [riskData, team, approvalStatus, productFilter]);
  const filteredProducts = useMemo(() => filterRows(productsData), [productsData, team, approvalStatus, productFilter]);
  const filteredFulfillment = useMemo(() => filterRows(fulfillmentData), [fulfillmentData, team, approvalStatus, productFilter]);
  const filteredBilling = useMemo(() => filterRows(billingData), [billingData, team, approvalStatus, productFilter]);

  // Dynamic KPIs depending on active Tab
  const dynamicKpis = useMemo(() => {
    switch (activeTab) {
      case 'deals':
        const totalAmount = filteredDeals.reduce((acc, d) => acc + (d.amount || 0), 0);
        return [
          { title: 'Quotes In Scope', value: String(filteredDeals.length), caption: 'Active commercial opportunities' },
          { title: 'Pipeline Value', value: formatMoney(totalAmount), caption: 'Total evaluated order amount' },
          { title: 'Avg Margin', value: '22.9%', caption: 'Blended commercial gross margin' },
        ];
      case 'approvals':
        const pendingCount = filteredApprovals.filter((a) => a.status === 'Pending').length;
        return [
          { title: 'Avg Approval Time', value: '6.4 hours', caption: 'Median SLA turnaround' },
          { title: 'Pending Signoffs', value: String(pendingCount), caption: 'Deals awaiting manager/finance' },
          { title: 'SLA Adherence', value: '94.2%', caption: 'Within 24-hour governance window' },
        ];
      case 'discounts':
        const violations = filteredDiscounts.filter((d) => d.compliance.includes('Violation')).length;
        return [
          { title: 'Discount Exposure', value: '₹1,42,000', caption: 'Total variance beyond standard list' },
          { title: 'Policy Violations', value: String(violations), caption: 'Deals requiring escalation' },
          { title: 'Highest Requested', value: '22.0%', caption: 'Cloud Server Appliance (Beta Ind.)' },
        ];
      case 'risk':
        const highRisk = filteredRisk.filter((r) => r.severity === 'HIGH').length;
        return [
          { title: 'High Risk Deals', value: String(highRisk), caption: 'Score > 50 (Escalated to SoD)' },
          { title: 'Avg Risk Score', value: '31.4 / 100', caption: 'Weighted commercial risk index' },
          { title: 'Autonomous Ratio', value: '68%', caption: 'Approved without escalation' },
        ];
      case 'products':
        const totalUnits = filteredProducts.reduce((acc, p) => acc + (p.units || 0), 0);
        return [
          { title: 'Top Upsold Product', value: 'Docking Station Hub', caption: '+₹98,000 incremental margin' },
          { title: 'Quoted Volume', value: `${totalUnits} units`, caption: 'Across active sales quotes' },
          { title: 'Highest Margin Category', value: 'Software (83.3%)', caption: 'Cloud Integration Connector' },
        ];
      case 'fulfillment':
        const multiSplits = filteredFulfillment.filter((f) => f.strategy.includes('Split')).length;
        return [
          { title: 'Multi-WH Splits', value: String(multiSplits), caption: 'Complex warehouse allocations' },
          { title: 'Delivery Accuracy', value: '98.8%', caption: 'Stock verified against Odoo' },
          { title: 'Active Dispatches', value: '3 Shipments', caption: 'In transit / allocated' },
        ];
      case 'billing':
        const totalInvoiced = filteredBilling.reduce((acc, b) => acc + (b.amount || 0), 0);
        const unpaidCount = filteredBilling.filter((b) => b.status !== 'Paid').length;
        return [
          { title: 'Total Invoiced', value: formatMoney(totalInvoiced), caption: 'Matched against deliveries' },
          { title: 'Pending Collection', value: String(unpaidCount), caption: 'Unpaid / Overdue invoices' },
          { title: 'Reconciliation Rate', value: '100%', caption: 'Invoiced amounts match fulfilled' },
        ];
    }
  }, [activeTab, filteredDeals, filteredApprovals, filteredDiscounts, filteredRisk, filteredProducts, filteredFulfillment, filteredBilling]);

  // Visual Chart Data
  const approvalTurnaroundData = [
    { stage: 'Sales Manager', hours: 4.2 },
    { stage: 'Finance Officer', hours: 8.6 },
    { stage: 'Overall SLA', hours: 6.4 },
  ];

  const discountCategoryData = [
    { category: 'Hardware', discount: 16.5, policyCap: 12.0 },
    { category: 'Software', discount: 15.0, policyCap: 15.0 },
    { category: 'Services', discount: 6.5, policyCap: 10.0 },
  ];

  const riskDistributionData = [
    { factor: 'Margin Compression', weight: 42 },
    { factor: 'Discount Outlier', weight: 34 },
    { factor: 'WH Split Logistics', weight: 24 },
  ];

  // Column Configurations for Export & Display
  const dealsColumns: ColumnDef<any>[] = [
    { key: 'ref', header: 'Reference', render: (d) => <span className="font-bold text-text-primary">{d.ref}</span> },
    { key: 'customer', header: 'Customer' },
    { key: 'rep', header: 'Sales Rep' },
    { key: 'team_name', header: 'Sales Team' },
    { key: 'amount', header: 'Order Amount', className: 'text-right', render: (d) => <span className="tabular-nums font-semibold">{formatMoney(d.amount)}</span> },
    { key: 'margin', header: 'Blended Margin', className: 'text-right' },
    {
      key: 'risk',
      header: 'Risk Score',
      className: 'text-center',
      render: (d) => (
        <span className={`font-bold ${d.risk >= 50 ? 'text-danger' : d.risk >= 25 ? 'text-amber-600' : 'text-emerald-600'}`}>
          {d.risk}
        </span>
      ),
    },
    { key: 'status', header: 'Status' },
  ];

  const approvalsColumns: ColumnDef<any>[] = [
    { key: 'ref', header: 'Reference', render: (d) => <span className="font-bold text-text-primary">{d.ref}</span> },
    { key: 'customer', header: 'Customer' },
    { key: 'stage', header: 'Stage' },
    { key: 'assigned_to', header: 'Assigned Approver' },
    { key: 'amount', header: 'Order Amount', className: 'text-right', render: (d) => <span className="tabular-nums">{formatMoney(d.amount)}</span> },
    { key: 'wait_hours', header: 'Wait Time (hrs)', className: 'text-center', render: (d) => <span className="font-semibold">{d.wait_hours}h</span> },
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
          d.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : d.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
        }`}>
          {d.status}
        </span>
      ),
    },
  ];

  const discountsColumns: ColumnDef<any>[] = [
    { key: 'deal_ref', header: 'Deal Ref', render: (d) => <span className="font-bold text-text-primary">{d.deal_ref}</span> },
    { key: 'customer', header: 'Customer' },
    { key: 'product', header: 'Product Item' },
    { key: 'category', header: 'Category' },
    { key: 'list_price', header: 'List Price', className: 'text-right', render: (d) => <span className="tabular-nums">{formatMoney(d.list_price)}</span> },
    { key: 'discount_pct', header: 'Discount (%)', className: 'text-center font-bold' },
    { key: 'policy_limit', header: 'Policy Cap (%)', className: 'text-center text-text-muted' },
    {
      key: 'variance',
      header: 'Variance',
      className: 'text-center font-bold',
      render: (d) => (
        <span className={d.variance.startsWith('+') ? 'text-danger' : 'text-emerald-600'}>
          {d.variance}
        </span>
      ),
    },
    {
      key: 'compliance',
      header: 'Governance Policy Status',
      render: (d) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
          d.compliance.includes('Violation')
            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
        }`}>
          {d.compliance.includes('Violation') ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {d.compliance}
        </span>
      ),
    },
  ];

  const riskColumns: ColumnDef<any>[] = [
    { key: 'ref', header: 'Reference', render: (d) => <span className="font-bold text-text-primary">{d.ref}</span> },
    { key: 'customer', header: 'Customer' },
    {
      key: 'risk_score',
      header: 'Risk Index',
      className: 'text-center',
      render: (d) => (
        <span className={`font-bold px-2 py-0.5 rounded text-xs ${
          d.risk_score >= 50 ? 'bg-red-100 text-red-700 font-extrabold' : d.risk_score >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {d.risk_score}
        </span>
      ),
    },
    { key: 'severity', header: 'Severity', render: (d) => <span className="font-semibold text-xs">{d.severity}</span> },
    { key: 'driver', header: 'Primary Risk Factor' },
    { key: 'margin', header: 'Margin', className: 'text-right' },
    { key: 'action', header: 'Governance Signoff Level' },
  ];

  const productsColumns: ColumnDef<any>[] = [
    { key: 'sku', header: 'SKU / Code', render: (d) => <span className="font-mono text-text-muted">{d.sku}</span> },
    { key: 'name', header: 'Product Name', render: (d) => <span className="font-bold text-text-primary">{d.name}</span> },
    { key: 'category', header: 'Category' },
    { key: 'list_price', header: 'List Price', className: 'text-right', render: (d) => formatMoney(d.list_price) },
    { key: 'cost_price', header: 'Unit Cost', className: 'text-right text-text-muted', render: (d) => formatMoney(d.cost_price) },
    { key: 'units', header: 'Units Quoted', className: 'text-center font-semibold' },
    { key: 'total_revenue', header: 'Total Value', className: 'text-right font-bold', render: (d) => formatMoney(d.total_revenue) },
    { key: 'margin', header: 'Gross Margin', className: 'text-right text-emerald-600 font-semibold' },
    { key: 'discount_cap', header: 'Discount Cap', className: 'text-center' },
  ];

  const fulfillmentColumns: ColumnDef<any>[] = [
    { key: 'order_ref', header: 'Order Ref', render: (d) => <span className="font-bold text-text-primary">{d.order_ref}</span> },
    { key: 'customer', header: 'Customer' },
    { key: 'split', header: 'Warehouse Split Allocation' },
    { key: 'strategy', header: 'Strategy' },
    {
      key: 'delivery_status',
      header: 'Delivery State',
      render: (d) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
          d.delivery_status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {d.delivery_status}
        </span>
      ),
    },
    { key: 'reconciliation', header: 'Stock Reconciliation' },
  ];

  const billingColumns: ColumnDef<any>[] = [
    { key: 'inv_no', header: 'Invoice Number', render: (d) => <span className="font-bold text-text-primary">{d.inv_no}</span> },
    { key: 'order_ref', header: 'Order Ref' },
    { key: 'customer', header: 'Customer' },
    { key: 'amount', header: 'Invoiced Amount', className: 'text-right font-bold', render: (d) => formatMoney(d.amount) },
    { key: 'paid_amount', header: 'Amount Paid', className: 'text-right', render: (d) => formatMoney(d.paid_amount) },
    { key: 'due_date', header: 'Due Date', className: 'text-center text-text-muted' },
    { key: 'reconciliation', header: 'Delivery Match' },
    {
      key: 'status',
      header: 'Payment Status',
      render: (d) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
          d.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : d.status === 'Unpaid' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
        }`}>
          {d.status}
        </span>
      ),
    },
  ];

  // Helper mapping active Tab to its dataset and column configs
  const activeTabConfig = useMemo(() => {
    switch (activeTab) {
      case 'deals':
        return {
          title: 'Deals Commercial Governance Report',
          subtitle: 'Detailed pipeline metrics, customer margins, and Deal Guardian risk classifications',
          data: filteredDeals,
          columns: dealsColumns,
          exportCols: [
            { key: 'ref', header: 'Reference', width: 25 },
            { key: 'customer', header: 'Customer', width: 40 },
            { key: 'rep', header: 'Sales Rep', width: 35 },
            { key: 'team_name', header: 'Sales Team', width: 30 },
            { key: 'amount', header: 'Order Amount', align: 'right' as const, width: 35 },
            { key: 'margin', header: 'Margin', align: 'right' as const, width: 25 },
            { key: 'risk', header: 'Risk Score', align: 'center' as const, width: 25 },
            { key: 'status', header: 'Status', width: 25 },
          ],
        };
      case 'approvals':
        return {
          title: 'Approval FSM Turnaround & SLA Report',
          subtitle: 'Audit trail of commercial approvals, stage durations, and Segregation of Duties compliance',
          data: filteredApprovals,
          columns: approvalsColumns,
          exportCols: [
            { key: 'ref', header: 'Reference', width: 25 },
            { key: 'customer', header: 'Customer', width: 45 },
            { key: 'stage', header: 'Approval Stage', width: 35 },
            { key: 'assigned_to', header: 'Assigned Approver', width: 50 },
            { key: 'amount', header: 'Amount', align: 'right' as const, width: 35 },
            { key: 'wait_hours', header: 'Wait Time (hrs)', align: 'center' as const, width: 30 },
            { key: 'status', header: 'Status', width: 25 },
          ],
        };
      case 'discounts':
        return {
          title: 'Discounts Governance & Policy Audit Report',
          subtitle: 'Line-item discount variance audits, customer tier caps, and Deal Guardian policy exception flags',
          data: filteredDiscounts,
          columns: discountsColumns,
          exportCols: [
            { key: 'deal_ref', header: 'Deal Ref', width: 25 },
            { key: 'customer', header: 'Customer', width: 40 },
            { key: 'product', header: 'Product Item', width: 55 },
            { key: 'category', header: 'Category', width: 25 },
            { key: 'list_price', header: 'List Price', align: 'right' as const, width: 30 },
            { key: 'discount_pct', header: 'Discount (%)', align: 'center' as const, width: 25 },
            { key: 'policy_limit', header: 'Cap (%)', align: 'center' as const, width: 20 },
            { key: 'variance', header: 'Variance', align: 'center' as const, width: 22 },
            { key: 'compliance', header: 'Policy Status', width: 35 },
          ],
        };
      case 'risk':
        return {
          title: 'Commercial Risk Matrix & Deal Exposure Report',
          subtitle: 'Blended risk score evaluations across margin erosion, credit terms, and fulfillment complexity',
          data: filteredRisk,
          columns: riskColumns,
          exportCols: [
            { key: 'ref', header: 'Reference', width: 25 },
            { key: 'customer', header: 'Customer', width: 40 },
            { key: 'risk_score', header: 'Risk Score', align: 'center' as const, width: 25 },
            { key: 'severity', header: 'Severity', width: 25 },
            { key: 'driver', header: 'Primary Risk Factor', width: 70 },
            { key: 'margin', header: 'Margin', align: 'right' as const, width: 25 },
            { key: 'action', header: 'Required Signoff', width: 45 },
          ],
        };
      case 'products':
        return {
          title: 'Master Catalog Product & Margin Intelligence',
          subtitle: 'SKU margin contribution, quoted volumes, and automated discount thresholds',
          data: filteredProducts,
          columns: productsColumns,
          exportCols: [
            { key: 'sku', header: 'SKU', width: 25 },
            { key: 'name', header: 'Product Name', width: 60 },
            { key: 'category', header: 'Category', width: 30 },
            { key: 'list_price', header: 'List Price', align: 'right' as const, width: 30 },
            { key: 'cost_price', header: 'Unit Cost', align: 'right' as const, width: 30 },
            { key: 'units', header: 'Units Quoted', align: 'center' as const, width: 25 },
            { key: 'total_revenue', header: 'Total Value', align: 'right' as const, width: 35 },
            { key: 'margin', header: 'Gross Margin', align: 'right' as const, width: 25 },
          ],
        };
      case 'fulfillment':
        return {
          title: 'Multi-Warehouse Fulfillment & Split Allocation Report',
          subtitle: 'Dispatch status, multi-warehouse stock allocations, and delivery confirmation audits',
          data: filteredFulfillment,
          columns: fulfillmentColumns,
          exportCols: [
            { key: 'order_ref', header: 'Order Ref', width: 25 },
            { key: 'customer', header: 'Customer', width: 45 },
            { key: 'split', header: 'Warehouse Allocation Split', width: 75 },
            { key: 'strategy', header: 'Strategy', width: 40 },
            { key: 'delivery_status', header: 'Delivery State', width: 30 },
            { key: 'reconciliation', header: 'Stock Match', width: 35 },
          ],
        };
      case 'billing':
        return {
          title: 'Billing Reconciliation & General Ledger Audit',
          subtitle: 'Delivery-reconciled invoicing, invoice aging, and payment collection tracking',
          data: filteredBilling,
          columns: billingColumns,
          exportCols: [
            { key: 'inv_no', header: 'Invoice Number', width: 30 },
            { key: 'order_ref', header: 'Order Ref', width: 25 },
            { key: 'customer', header: 'Customer', width: 45 },
            { key: 'amount', header: 'Invoiced Amount', align: 'right' as const, width: 35 },
            { key: 'paid_amount', header: 'Paid Amount', align: 'right' as const, width: 35 },
            { key: 'due_date', header: 'Due Date', align: 'center' as const, width: 30 },
            { key: 'reconciliation', header: 'Delivery Match', width: 40 },
            { key: 'status', header: 'Status', width: 25 },
          ],
        };
    }
  }, [activeTab, filteredDeals, filteredApprovals, filteredDiscounts, filteredRisk, filteredProducts, filteredFulfillment, filteredBilling]);

  // Export handlers
  const handleExport = (format: 'pdf' | 'xlsx') => {
    setIsExporting(format);
    try {
      const options = {
        title: activeTabConfig.title,
        subtitle: activeTabConfig.subtitle,
        tabKey: activeTab,
        columns: activeTabConfig.exportCols as ReportColumnConfig[],
        data: activeTabConfig.data,
        filters: { period, team, approvalStatus, productFilter },
        kpis: dynamicKpis,
      };

      if (format === 'pdf') {
        exportReportToPdf(options);
      } else {
        exportReportToXls(options);
      }
    } finally {
      setIsExporting(null);
    }
  };

  const handleResetFilters = () => {
    setPeriod('month');
    setTeam('all');
    setApprovalStatus('all');
    setProductFilter('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin / Reporting Dashboard"
        subtitle="Comprehensive BI analytics, turnaround metrics, and executive regulatory exports"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport('pdf')}
              disabled={isExporting !== null}
              className="gap-1.5 text-xs bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5 text-sky-600" />
              <span>{isExporting === 'pdf' ? 'Generating PDF…' : 'Export PDF'}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport('xlsx')}
              disabled={isExporting !== null}
              className="gap-1.5 text-xs bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>{isExporting === 'xlsx' ? 'Exporting XLS…' : 'Export XLS'}</span>
            </Button>
          </div>
        }
      />

      {/* Top Filter Controls */}
      <ReportFilters
        period={period}
        onPeriodChange={setPeriod}
        team={team}
        onTeamChange={setTeam}
        approvalStatus={approvalStatus}
        onApprovalStatusChange={setApprovalStatus}
        productFilter={productFilter}
        onProductFilterChange={setProductFilter}
        onReset={handleResetFilters}
      />

      {/* Dynamic 3 Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dynamicKpis.map((kpi, idx) => (
          <KpiCard key={idx} title={kpi.title} value={kpi.value} caption={kpi.caption} />
        ))}
      </div>

      {/* Report Navigation Tabs (Lower Nav Bar) */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto">
        {(
          [
            { key: 'deals', label: 'Deals Report' },
            { key: 'approvals', label: 'Approvals Report' },
            { key: 'discounts', label: 'Discounts Report' },
            { key: 'risk', label: 'Risk Report' },
            { key: 'products', label: 'Products Report' },
            { key: 'fulfillment', label: 'Fulfillment Report' },
            { key: 'billing', label: 'Billing Report' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold border border-slate-200 dark:border-slate-700'
                : 'text-text-muted hover:text-text-primary hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Visual Analytics Charts when applicable */}
      {activeTab === 'approvals' && (
        <div className="rounded-card border border-border bg-surface p-5">
          <h4 className="text-xs font-bold text-text-secondary uppercase mb-4 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-sky-600" />
            Approval Turnaround by Stage (Hours)
          </h4>
          <div className="h-44 w-full max-w-lg">
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
                <Bar dataKey="hours" fill="#0284C7" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'discounts' && (
        <div className="rounded-card border border-border bg-surface p-5">
          <h4 className="text-xs font-bold text-text-secondary uppercase mb-4 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Average Discount % vs Governance Policy Cap by Category
          </h4>
          <div className="h-44 w-full max-w-lg">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={discountCategoryData}>
                <XAxis dataKey="category" stroke="#64748B" fontSize={11} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} unit="%" />
                <Tooltip
                  formatter={(val: any, name: any) => [`${val}%`, name === 'discount' ? 'Avg Discount' : 'Policy Cap']}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="discount" fill="#DC2626" name="discount" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="policyCap" fill="#64748B" name="policyCap" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="rounded-card border border-border bg-surface p-5">
          <h4 className="text-xs font-bold text-text-secondary uppercase mb-4 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-danger" />
            Commercial Risk Factor Contribution (%)
          </h4>
          <div className="h-44 w-full max-w-lg">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistributionData}>
                <XAxis dataKey="factor" stroke="#64748B" fontSize={11} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} unit="%" />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Factor Weight']}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="weight" fill="#E11D48" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Primary Report Data Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-text-muted px-1">
          <span>
            Displaying <strong className="text-text-primary">{activeTabConfig.data.length}</strong> {activeTab} records
          </span>
          {(team !== 'all' || approvalStatus !== 'all' || productFilter) && (
            <span className="text-amber-600 font-medium">Filtered results</span>
          )}
        </div>
        <DataTable
          data={activeTabConfig.data}
          columns={activeTabConfig.columns}
          emptyMessage={`No records match active filters for ${activeTabConfig.title}. Try changing or resetting filters.`}
        />
      </div>
    </div>
  );
};

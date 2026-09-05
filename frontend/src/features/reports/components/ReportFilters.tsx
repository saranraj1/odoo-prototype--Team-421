import React from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface ReportFiltersProps {
  period: string;
  onPeriodChange: (p: string) => void;
  approvalStatus: string;
  onApprovalStatusChange: (s: string) => void;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  period,
  onPeriodChange,
  approvalStatus,
  onApprovalStatusChange,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-surface p-3.5 rounded-card border border-border">
      <div>
        <label className="text-[11px] font-semibold text-text-secondary block mb-1">Time Period</label>
        <Select value={period} onChange={(e) => onPeriodChange(e.target.value)} className="h-8 text-xs">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="custom">Custom Range</option>
        </Select>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-text-secondary block mb-1">Sales Team</label>
        <Select defaultValue="all" className="h-8 text-xs">
          <option value="all">All Teams</option>
          <option value="1">North Team</option>
          <option value="2">South Team</option>
        </Select>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-text-secondary block mb-1">Approval Status</label>
        <Select value={approvalStatus} onChange={(e) => onApprovalStatusChange(e.target.value)} className="h-8 text-xs">
          <option value="all">All States</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-text-secondary block mb-1">Product Filter</label>
        <Input placeholder="Filter by product name…" className="h-8 text-xs" />
      </div>
    </div>
  );
};

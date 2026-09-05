import React from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface ReportFiltersProps {
  period: string;
  onPeriodChange: (p: string) => void;
  team: string;
  onTeamChange: (t: string) => void;
  approvalStatus: string;
  onApprovalStatusChange: (s: string) => void;
  productFilter: string;
  onProductFilterChange: (q: string) => void;
  onReset?: () => void;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  period,
  onPeriodChange,
  team,
  onTeamChange,
  approvalStatus,
  onApprovalStatusChange,
  productFilter,
  onProductFilterChange,
  onReset,
}) => {
  const hasActiveFilters =
    period !== 'month' || team !== 'all' || approvalStatus !== 'all' || productFilter.trim() !== '';

  return (
    <div className="bg-surface p-3.5 rounded-card border border-border space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
          <Select value={team} onChange={(e) => onTeamChange(e.target.value)} className="h-8 text-xs">
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
          <label className="text-[11px] font-semibold text-text-secondary block mb-1">Product / Query Filter</label>
          <Input
            value={productFilter}
            onChange={(e) => onProductFilterChange(e.target.value)}
            placeholder="Filter by product, customer, ref…"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {hasActiveFilters && onReset && (
        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="h-6 text-[11px] text-text-muted hover:text-text-primary gap-1 px-2"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  );
};


import React from 'react';
import { cn } from '@/lib/utils';
import type { RiskSeverity } from '@/api/types';

interface RiskBadgeProps {
  score: number | null | undefined;
  severity?: RiskSeverity;
  className?: string;
  showSeverityText?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  score,
  severity,
  className,
  showSeverityText = false,
}) => {
  if (score === null || score === undefined) {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-semibold bg-elevated text-text-muted border border-border', className)}>
        —
      </span>
    );
  }

  const num = typeof score === 'number' ? score : parseFloat(String(score));
  let colorClass = 'bg-success/20 text-success border-success/40';
  let sevLabel = 'LOW';

  if (severity === 'HIGH' || num >= 50) {
    colorClass = 'bg-danger/20 text-danger border-danger/40';
    sevLabel = 'HIGH';
  } else if (severity === 'MEDIUM' || num >= 20) {
    colorClass = 'bg-warning/20 text-warning border-warning/40';
    sevLabel = 'MEDIUM';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-chip text-xs font-semibold border tabular-nums',
        colorClass,
        className
      )}
      aria-label={`Risk score ${num.toFixed(1)}, severity ${sevLabel}`}
    >
      <span>{num.toFixed(1)}</span>
      {showSeverityText && <span className="opacity-80 font-normal">({sevLabel})</span>}
    </span>
  );
};

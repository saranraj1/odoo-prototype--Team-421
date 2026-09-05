import React from 'react';
import { cn } from '@/lib/utils';
import type { HealthStatus } from '@/api/types';

interface HealthBadgeProps {
  status: HealthStatus | string | null | undefined;
  className?: string;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({ status, className }) => {
  const s = status ? status.toUpperCase() : 'HEALTHY';

  let colorClass = 'bg-success/20 text-success border-success/40';
  let label = 'Healthy';

  if (s === 'AT_RISK') {
    colorClass = 'bg-danger/20 text-danger border-danger/40';
    label = 'At Risk';
  } else if (s === 'WATCH') {
    colorClass = 'bg-warning/20 text-warning border-warning/40';
    label = 'Watch';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium border',
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
};

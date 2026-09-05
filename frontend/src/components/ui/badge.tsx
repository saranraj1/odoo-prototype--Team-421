import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-chip border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-brand text-brand-ink',
        secondary: 'border-border bg-elevated text-text-primary',
        success: 'border-transparent bg-success/20 text-success border border-success/40',
        warning: 'border-transparent bg-warning/20 text-warning border border-warning/40',
        danger: 'border-transparent bg-danger/20 text-danger border border-danger/40',
        info: 'border-transparent bg-info/20 text-info border border-info/40',
        outline: 'border-border text-text-secondary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

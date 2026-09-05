import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, children, ...props }, ref) => {
    return (
      <div className={cn('relative flex w-full items-center', containerClassName)}>
        <select
          className={cn(
            'flex h-9 w-full appearance-none rounded-input border border-border bg-surface px-3 py-1 pr-8 text-sm text-text-primary shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer truncate',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-text-muted opacity-70 shrink-0" />
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };

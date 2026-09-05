import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  status: 'done' | 'current' | 'pending';
}

interface StepperProps {
  steps: Step[];
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({ steps, className }) => {
  return (
    <div className={cn('flex items-center w-full', className)}>
      {steps.map((step, idx) => {
        const isDone = step.status === 'done';
        const isCurrent = step.status === 'current';
        const isLast = idx === steps.length - 1;

        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-chip text-xs font-semibold transition-colors',
                  isDone
                    ? 'bg-success text-brand-ink'
                    : isCurrent
                    ? 'bg-brand text-brand-ink ring-4 ring-brand/20 font-bold'
                    : 'bg-elevated text-text-muted border border-border'
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-xs text-center whitespace-nowrap',
                  isCurrent ? 'text-brand font-semibold' : isDone ? 'text-text-primary' : 'text-text-muted'
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'h-[2px] flex-1 mx-2 mb-4 transition-colors',
                  isDone ? 'bg-success' : 'bg-border'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

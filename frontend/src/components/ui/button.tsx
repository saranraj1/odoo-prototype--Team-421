import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-input text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-ink hover:bg-brand/90 font-semibold shadow-sm',
        success: 'bg-success text-brand-ink hover:bg-success/90 font-semibold shadow-sm',
        danger: 'bg-danger text-text-primary hover:bg-danger/90 font-semibold shadow-sm',
        warning: 'bg-warning text-brand-ink hover:bg-warning/90 font-semibold shadow-sm',
        secondary: 'bg-elevated text-text-primary hover:bg-elevated/80 border border-border',
        outline: 'border border-border bg-transparent hover:bg-elevated text-text-primary',
        ghost: 'hover:bg-elevated text-text-secondary hover:text-text-primary',
        link: 'text-brand underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-input px-3 text-xs',
        lg: 'h-10 rounded-input px-6 text-base',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

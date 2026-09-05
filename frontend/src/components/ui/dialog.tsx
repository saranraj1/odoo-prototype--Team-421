import * as React from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full max-w-lg rounded-card border border-border bg-surface p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
        <div className="flex flex-col space-y-1.5 text-left mb-4">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          {description && (
            <p className="text-xs text-text-secondary">{description}</p>
          )}
        </div>
        <div className="py-2">{children}</div>
        {footer && <div className="flex justify-end space-x-2 mt-4">{footer}</div>}
      </div>
    </div>
  );
};

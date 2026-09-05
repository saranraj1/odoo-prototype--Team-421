import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const InvalidationBanner: React.FC = () => {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-input border border-danger/50 bg-danger/15 px-4 py-3 text-xs text-text-primary shadow-md animate-in fade-in"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-danger text-text-primary">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <div>
        <span className="font-bold text-danger block uppercase tracking-wider text-[11px]">
          Previous Approval Invalidated
        </span>
        <p className="text-text-secondary mt-0.5 leading-relaxed">
          Commercial terms worsened after approval (Setup Service discount countered to 22%). Deal locked pending re-approval by Sales Manager & Finance.
        </p>
      </div>
    </div>
  );
};

import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HintStripProps {
  children: React.ReactNode;
  className?: string;
}

export const HintStrip: React.FC<HintStripProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-input border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs text-slate-700 mt-3 mb-2 shadow-2xs',
        className
      )}
      role="note"
    >
      <Info className="h-4 w-4 shrink-0 text-sky-700 mt-0.5" />
      <div className="leading-relaxed font-normal">{children}</div>
    </div>
  );
};

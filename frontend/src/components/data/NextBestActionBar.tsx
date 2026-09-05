import React from 'react';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NextBestAction } from '@/api/types';

interface NextBestActionBarProps {
  action?: NextBestAction | null;
  onExecute?: (action: NextBestAction) => void;
  isLoading?: boolean;
}

export const NextBestActionBar: React.FC<NextBestActionBarProps> = ({
  action,
  onExecute,
  isLoading = false,
}) => {
  if (!action || action.type === 'NONE') return null;

  return (
    <aside
      aria-label="Next Best Action"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-brand/40 bg-elevated/95 px-6 py-3 backdrop-blur shadow-2xl transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-brand/20 text-brand">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand">
                Next Best Action
              </span>
              <span className="rounded bg-brand/10 px-1.5 py-0.2 text-[10px] font-semibold text-brand">
                P{action.priority}
              </span>
            </div>
            <p className="text-sm font-semibold text-text-primary">{action.title}</p>
            <p className="text-xs text-text-secondary">{action.explanation}</p>
          </div>
        </div>

        {onExecute && action.cta_endpoint && (
          <Button
            size="sm"
            onClick={() => onExecute(action)}
            disabled={isLoading}
            className="shrink-0 gap-1.5 font-semibold"
          >
            Execute Action
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
};

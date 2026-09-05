import React from 'react';
import { formatRelativeDate, formatAbsoluteDate } from '@/lib/format';
import type { TimelineEvent } from '@/api/types';

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ events, className }) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-xs text-text-muted py-4 text-center">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {events.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-3 rounded-input border border-border/60 bg-surface/80 p-3 text-xs"
        >
          <div className="h-2 w-2 rounded-full bg-brand mt-1.5 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary">
                {e.actor_name}{' '}
                <span className="font-normal text-text-muted">({e.actor_role})</span>
              </span>
              <span
                className="text-text-muted cursor-help"
                title={formatAbsoluteDate(e.created_at)}
              >
                {formatRelativeDate(e.created_at)}
              </span>
            </div>
            <p className="mt-1 text-text-secondary">
              {e.summary || e.reason || e.event_type}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

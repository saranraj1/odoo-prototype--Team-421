import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  caption?: string;
  to?: string;
  onClick?: () => void;
  className?: string;
  valueClassName?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  caption,
  to,
  onClick,
  className,
  valueClassName,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    }
  };

  return (
    <Card
      className={cn(
        'transition-all duration-150',
        to || onClick ? 'cursor-pointer hover:border-brand/50 hover:bg-elevated/40' : '',
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="p-3.5 sm:p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-text-secondary truncate">
          {title}
        </p>
        <div
          title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
          className={cn(
            'mt-2 font-bold tracking-tight text-text-primary tabular-nums truncate',
            typeof value === 'string' && value.length > 10
              ? 'text-lg xl:text-xl'
              : typeof value === 'string' && value.length > 7
              ? 'text-xl xl:text-2xl'
              : 'text-2xl',
            valueClassName
          )}
        >
          {value}
        </div>
        {caption && (
          <p className="mt-1 text-xs text-text-muted truncate">{caption}</p>
        )}
      </CardContent>
    </Card>
  );
};

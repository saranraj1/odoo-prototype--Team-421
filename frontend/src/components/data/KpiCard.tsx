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
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          {title}
        </p>
        <div
          className={cn(
            'mt-2 text-2xl font-bold tracking-tight text-text-primary tabular-nums',
            valueClassName
          )}
        >
          {value}
        </div>
        {caption && (
          <p className="mt-1 text-xs text-text-muted">{caption}</p>
        )}
      </CardContent>
    </Card>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { StatusChip } from '@/components/data/StatusChip';
import { portalApi } from '@/api/endpoints/portal';
import { queryKeys } from '@/api/queryKeys';
import { formatMoney, formatRelativeDate } from '@/lib/format';
import { ArrowRight } from 'lucide-react';

export const PortalQuotationsListPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: deals = [], isLoading } = useQuery({
    queryKey: queryKeys.portal.deals,
    queryFn: () => portalApi.getDeals(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Commercial Quotations"
        subtitle="Review, negotiate, and confirm active sales proposals"
      />

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-24 rounded-card bg-elevated/40 animate-pulse" />
        </div>
      ) : deals.length === 0 ? (
        <div className="p-8 text-center rounded-card border border-border bg-surface text-text-muted text-xs">
          No quotations currently available for your organization.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deals.map((deal) => (
            <Card
              key={deal.id}
              onClick={() => navigate(`/portal/quotations/${deal.id}`)}
              className="border-border bg-surface hover:border-brand/50 hover:bg-elevated/30 transition-all cursor-pointer p-5"
            >
              <CardContent className="p-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-text-primary">{deal.number}</span>
                  <StatusChip status={deal.portal_status} />
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-border/40">
                  <span className="text-xs text-text-secondary">Quotation Total:</span>
                  <span className="text-lg font-bold text-brand tabular-nums">
                    {formatMoney(deal.total, deal.currency_code)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
                  <span>Updated {formatRelativeDate(deal.updated_at)}</span>
                  <div className="flex items-center gap-1 text-brand font-medium">
                    <span>Review Proposal</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

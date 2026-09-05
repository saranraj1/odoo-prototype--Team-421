import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Plus, X } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import type { DealRecommendation } from '@/api/types';

interface RecommendationCardsProps {
  recommendations: DealRecommendation[];
  onAdd: (recId: string) => void;
  onDismiss: (recId: string) => void;
  currency?: string;
}

export const RecommendationCards: React.FC<RecommendationCardsProps> = ({
  recommendations,
  onAdd,
  onDismiss,
  currency = 'INR',
}) => {
  const activeRecs = recommendations.filter((r) => r.status === 'ACTIVE');

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" />
        <h4 className="text-xs font-bold text-info uppercase tracking-wider">
          Upsell & Cross-Sell Suggestions
        </h4>
      </div>

      {activeRecs.length === 0 ? (
        <p className="text-xs text-text-muted italic py-2">
          No suggestions above the margin threshold.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeRecs.map((rec) => (
            <Card
              key={rec.id}
              className="border-border bg-surface hover:border-brand/40 transition-all p-3"
            >
              <CardContent className="p-0 space-y-2">
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <span className="font-semibold text-xs text-text-primary">
                      + {rec.product_name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-bold text-success tabular-nums">
                        Margin +{formatMoney(rec.margin_delta_amount, currency)}
                      </span>
                      {rec.is_promoted && (
                        <span className="rounded bg-brand/20 px-1 py-0.2 text-[9px] font-bold text-brand uppercase">
                          Promo
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-6 px-2 text-[11px] font-semibold gap-1"
                      onClick={() => onAdd(rec.id)}
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </Button>
                    <button
                      type="button"
                      onClick={() => onDismiss(rec.id)}
                      className="p-1 text-text-muted hover:text-text-primary rounded-chip"
                      title="Dismiss suggestion"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-text-secondary leading-snug">
                  {rec.reason}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { dealsApi } from '@/api/endpoints/deals';
import { queryKeys } from '@/api/queryKeys';

export const AssessmentDetailPage: React.FC = () => {
  const { id = '', aid = '' } = useParams();
  const navigate = useNavigate();

  const { data: workspace } = useQuery({
    queryKey: queryKeys.deals.workspace(id),
    queryFn: () => dealsApi.getWorkspace(id),
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/quotations/${id}`)}
          className="gap-1 text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotation Workspace
        </Button>
      </div>

      <PageHeader
        title={`Guardian Assessment Snapshot: ${aid}`}
        subtitle={`Audit record of governance evaluation for ${workspace?.deal?.reference || 'D-1024'}`}
      />

      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Evaluation Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-4 border-b border-border pb-3">
            <div>
              <span className="text-text-muted">Calculated At:</span>
              <p className="font-semibold text-text-primary">{workspace?.risk?.calculated_at || '—'}</p>
            </div>
            <div>
              <span className="text-text-muted">Blended Risk Score:</span>
              <p className="font-bold text-danger text-sm">{workspace?.risk?.score ?? 56.0} (HIGH)</p>
            </div>
          </div>

          <div>
            <span className="font-semibold text-text-secondary block mb-2">Evaluated Risk Factors:</span>
            <ul className="space-y-2">
              {workspace?.risk?.factors.map((f, i) => (
                <li key={i} className="p-2.5 rounded bg-elevated/60 border border-border flex justify-between">
                  <span>{f.reason}</span>
                  <span className="font-bold text-danger">+{f.contribution} pts</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

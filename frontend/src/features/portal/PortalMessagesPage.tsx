import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export const PortalMessagesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Negotiation Messages"
        subtitle="Direct communication history with your assigned sales representative"
      />

      <Card className="border-border bg-surface p-6">
        <CardContent className="p-0 text-center py-8 space-y-3">
          <MessageSquare className="h-10 w-10 text-brand mx-auto opacity-70" />
          <h4 className="text-sm font-semibold text-text-primary">All Communications Synced</h4>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            You can comment on individual quote lines or send counter-proposals directly from your quotation view.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

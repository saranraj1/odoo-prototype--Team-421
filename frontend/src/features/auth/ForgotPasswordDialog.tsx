import React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ODOO_URL } from '@/lib/constants';
import { ExternalLink } from 'lucide-react';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reset Password"
      description="Internal account credentials are managed directly in Odoo ERP."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => window.open(`${ODOO_URL}/web/reset_password`, '_blank')}
            className="gap-1.5"
          >
            <span>Open Odoo Reset</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      }
    >
      <div className="text-xs text-text-secondary py-2">
        <p>
          DealFlow360 uses your central Odoo credentials for authentication. To reset your password, please use the standard Odoo password recovery interface or contact your system administrator.
        </p>
      </div>
    </Dialog>
  );
};

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Mail } from 'lucide-react';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim()) {
      setIsSubmitted(true);
    }
  };

  const handleClose = () => {
    setIsSubmitted(false);
    setIdentifier('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title="Reset Password"
      description="Enter your registered corporate email address or username to receive password reset instructions."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            {isSubmitted ? 'Close' : 'Cancel'}
          </Button>
          {!isSubmitted && (
            <Button
              size="sm"
              variant="default"
              onClick={handleSubmit}
              disabled={!identifier.trim()}
              className="font-bold"
            >
              Send Reset Link
            </Button>
          )}
        </div>
      }
    >
      <div className="text-xs text-text-secondary py-2">
        {isSubmitted ? (
          <div className="p-3.5 rounded-card bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Password Reset Instructions Sent</p>
              <p className="leading-relaxed">
                If an account exists for <strong>{identifier}</strong>, a secure password reset link has been dispatched.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="font-semibold text-text-primary block mb-1.5">
                Email Address or Username
              </label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                <Input
                  type="text"
                  placeholder="e.g. admin@dealflow.test or admin"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-8 text-xs h-9"
                  autoFocus
                />
              </div>
            </div>
            <p className="text-[11px] text-text-muted">
              For security reasons, system administrators must approve password changes for privileged roles.
            </p>
          </form>
        )}
      </div>
    </Dialog>
  );
};

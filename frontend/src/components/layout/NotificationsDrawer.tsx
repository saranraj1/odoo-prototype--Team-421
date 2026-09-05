import React from 'react';
import { X, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelativeDate } from '@/lib/format';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/endpoints/notifications';
import { queryKeys } from '@/api/queryKeys';
import type { NotificationItem } from '@/api/types';
import { useNavigate } from 'react-router-dom';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  onClose,
  notifications,
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
    },
  });

  if (!open) return null;

  const handleNotificationClick = (item: NotificationItem) => {
    markOneMutation.mutate(item.id);
    if (item.entity_type === 'deal' && item.entity_id) {
      navigate(`/quotations/${item.entity_id}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-surface border-l border-border shadow-2xl flex flex-col z-50">
        <div className="flex items-center justify-between p-4 border-b border-border bg-elevated">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
            <p className="text-xs text-text-muted">Real-time governance alerts & updates</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAllMutation.mutate()}
              title="Mark all as read"
              className="text-xs h-7 px-2"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all
            </Button>
            <button
              onClick={onClose}
              className="p-1 text-text-muted hover:text-text-primary rounded-chip"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-xs text-text-muted">
              No unread notifications.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`pt-2.5 pb-1 px-2 rounded-input transition-colors cursor-pointer ${
                  n.is_read ? 'opacity-60' : 'bg-elevated/40 hover:bg-elevated'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">{n.title}</span>
                  <span className="text-[10px] text-text-muted">
                    {formatRelativeDate(n.created_at)}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-1">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

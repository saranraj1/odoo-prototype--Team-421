import { apiClient } from '../client';
import type { NotificationItem } from '../types';

export const notificationsApi = {
  list: (unreadOnly: boolean = true): Promise<NotificationItem[]> =>
    apiClient(`/notifications?unread=${unreadOnly}`),

  markAsRead: (id: string): Promise<void> =>
    apiClient(`/notifications/${id}/read`, { method: 'POST' }),

  markAllAsRead: (): Promise<void> =>
    apiClient('/notifications/read-all', { method: 'POST' }),
};

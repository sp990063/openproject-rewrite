// components/notifications/NotificationItem.tsx
// 單一通知條目組件
'use client';

import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/router';
import type { Notification } from '@/types/notification';
import { NOTIFICATION_REASONS } from '@/types/notification';
import { cn } from '@/lib/utils';
import { useMarkNotificationAsRead } from '@/hooks/useNotificationMutations';

interface NotificationItemProps {
  notification: Notification;
}

const REASON_ICONS: Record<string, string> = {
  mentioned: '💬',
  commented: '💬',
  assigned: '📋',
  responsible: '📋',
  watched: '👁️',
  created: '📝',
  updated: '📝',
  deleted: '🗑️',
};

export function NotificationItem({ notification }: NotificationItemProps) {
  const router = useRouter();
  const markAsRead = useMarkNotificationAsRead();

  const icon = REASON_ICONS[notification.reason] ?? '📌';
  const actionText = NOTIFICATION_REASONS[notification.reason] ?? notification.reason;

  const handleClick = async () => {
    if (!notification.read) {
      try {
        await markAsRead.mutateAsync(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // 導航到資源頁面
    const resourcePath = getResourcePath(notification);
    if (resourcePath) {
      void router.push(resourcePath);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
        !notification.read && 'bg-blue-50 hover:bg-blue-100'
      )}
    >
      {/* 未讀藍色圓點指示器 */}
      {!notification.read && (
        <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
      )}
      {notification.read && <span className="mt-1.5 w-2 flex-shrink-0" />}

      {/* 圖標 */}
      <span className="text-xl flex-shrink-0">{icon}</span>

      {/* 內容 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">
          <span className="font-medium">{notification.actorName}</span>
          {' '}
          <span className="text-gray-600">{actionText}</span>
          {' '}
          <span className="font-medium">{notification.resourceSubject}</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {notification.projectName}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function getResourcePath(notification: Notification): string | null {
  switch (notification.resourceType) {
    case 'work_package':
      return `/projects/${notification.projectId}/work-packages/${notification.resourceId}`;
    case 'wiki_page':
      return `/projects/${notification.projectId}/wiki/${notification.resourceId}`;
    case 'forum_thread':
      return `/projects/${notification.projectId}/forums/${notification.resourceId}`;
    case 'meeting':
      return `/projects/${notification.projectId}/meetings/${notification.resourceId}`;
    case 'document':
      return `/projects/${notification.projectId}/documents/${notification.resourceId}`;
    default:
      return null;
  }
}

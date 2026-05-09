// components/notifications/NotificationBell.tsx
// 通知鈴鐺組件（帶未讀計數 + 實時更新）
'use client';

import Link from 'next/link';
import { useUnreadCount, useNotifications } from '@/hooks/useNotifications';
import { useMarkNotificationAsRead } from '@/hooks/useNotificationMutations';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu';
import { NOTIFICATION_REASONS, type Notification } from '@/types/notification';

export function NotificationBell() {
  const { data: unreadCount = 0, isLoading } = useUnreadCount();
  const { data } = useNotifications({ page: 1, perPage: 5 });
  const markRead = useMarkNotificationAsRead();

  const notifications = data?.data?.notifications ?? [];
  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

  const handleNotificationClick = (id: string, isRead: boolean) => {
    if (!isRead) {
      markRead.mutate(id);
    }
  };

  const getNotificationHref = (notification: Notification) => {
    switch (notification.resourceType) {
      case 'work_package':
        return `/projects/${notification.projectId}/work-packages/${notification.resourceId}`;
      case 'wiki_page':
        return `/projects/${notification.projectId}/wiki/${notification.resourceId}`;
      case 'forum_thread':
        return `/projects/${notification.projectId}/forums/${notification.resourceId}`;
      default:
        return `/notifications`;
    }
  };

  const getNotificationMessage = (notification: Notification) => {
    const reasonText = NOTIFICATION_REASONS[notification.reason] ?? notification.reason;
    return `${notification.actorName} ${reasonText} ${notification.resourceSubject}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {/* Unread count badge */}
          {!isLoading && unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
              {displayCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <span className="font-semibold text-gray-900">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-xs text-red-500 font-medium">{unreadCount} unread</span>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            No notifications yet
          </div>
        ) : (
          <>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => {
                const href = getNotificationHref(notification);
                const message = getNotificationMessage(notification);
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className="px-4 py-3 cursor-pointer"
                    onSelect={() => handleNotificationClick(notification.id, notification.read)}
                  >
                    <Link href={href} className="block w-full">
                      <div className={`text-sm ${notification.read ? 'text-gray-500' : 'text-gray-900 font-medium'}`}>
                        {message}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatRelativeTime(notification.createdAt)}
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </div>
            <div className="border-t border-gray-100">
              <Link
                href="/notifications"
                className="block text-center text-sm text-blue-600 hover:text-blue-500 py-3"
              >
                View all notifications
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

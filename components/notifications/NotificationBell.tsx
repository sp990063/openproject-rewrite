// components/notifications/NotificationBell.tsx
// 通知鈴鐺組件（帶未讀計數徽章）
'use client';

import { useUnreadCount } from '@/hooks/useNotifications';

export function NotificationBell() {
  const { data: unreadCount = 0, isLoading } = useUnreadCount();

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
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

      {/* 未讀計數徽章 */}
      {!isLoading && unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
          {displayCount}
        </span>
      )}
    </button>
  );
}

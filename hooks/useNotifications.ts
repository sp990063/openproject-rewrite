// hooks/useNotifications.ts
// 通知列表查詢鉤子 + 未讀計數鉤子
import { useQuery } from '@tanstack/react-query'
import type { Notification } from '@/types/notification'

interface NotificationsResponse {
  success: boolean
  data: {
    notifications: Notification[]
    meta: {
      page: number
      perPage: number
      total: number
      totalPages: number
      unreadCount: number
    }
  }
}

interface UseNotificationsOptions {
  page?: number
  perPage?: number
  unreadOnly?: boolean
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { page = 1, perPage = 20, unreadOnly = false } = options
  return useQuery({
    queryKey: ['notifications', { page, perPage, unreadOnly }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage) })
      if (unreadOnly) params.set('unread', 'true')
      const res = await fetch(`/api/notifications?${params}`)
      if (!res.ok) throw new Error('Failed to fetch notifications')
      return res.json()
    },
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/unread-count')
      if (!res.ok) throw new Error('Failed to fetch unread count')
      const json = await res.json()
      return (json.data as { unreadCount: number }).unreadCount
    },
    refetchInterval: 30_000, // 每 30 秒輪詢
  })
}

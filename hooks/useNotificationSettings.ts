// hooks/useNotificationSettings.ts
// 通知設置查詢與更新鉤子
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { NotificationSetting } from '@/types/notification'

export function useNotificationSettings() {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const res = await fetch('/api/notification-settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      const json = await res.json()
      return json.data.settings as NotificationSetting[]
    },
  })
}

export function useUpdateNotificationSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      notificationType: string
      projectId?: string | null
      emailEnabled?: boolean
      inAppEnabled?: boolean
      digestEnabled?: boolean
    }) => {
      const res = await fetch('/api/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update setting')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] })
    },
  })
}

import { useQuery } from '@tanstack/react-query'

export interface Announcement {
  id: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  dismissible: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

const DISMISSED_KEY = 'dismissed_announcements'

function getDismissedIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')
  } catch {
    return []
  }
}

function dismissAnnouncement(id: string): void {
  const dismissed = getDismissedIds()
  if (!dismissed.includes(id)) {
    dismissed.push(id)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed))
  }
}

export function useAnnouncements() {
  const { data, isLoading, error } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await fetch('/api/announcements')
      if (!res.ok) throw new Error('Failed to fetch announcements')
      return res.json()
    },
  })

  const dismissedIds = typeof window !== 'undefined' ? getDismissedIds() : []

  const activeAnnouncements = data?.filter(a => {
    if (dismissedIds.includes(a.id)) return false
    return true
  }) || []

  const dismiss = (id: string) => {
    dismissAnnouncement(id)
  }

  return {
    announcements: activeAnnouncements,
    isLoading,
    error,
    dismiss,
  }
}

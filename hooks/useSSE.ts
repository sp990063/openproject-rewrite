import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface SSEEvent {
  type: string
  payload: unknown
  timestamp: number
}

export function useSSE(userId: string | undefined) {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)

  const handleEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'connected':
        console.log('[SSE] Connected')
        break
      case 'work_package.updated':
      case 'work_package.created':
        queryClient.invalidateQueries({ queryKey: ['work-packages'] })
        break
      case 'notification.new':
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        break
      default:
        console.log('[SSE] Unknown event:', event.type)
    }
  }, [queryClient])

  useEffect(() => {
    if (!userId) return

    const eventSource = new EventSource(`/api/sse?userId=${userId}`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SSEEvent
        handleEvent(data)
      } catch (error) {
        console.error('[SSE] Parse error:', error)
      }
    }

    eventSource.onerror = () => {
      console.error('[SSE] Connection error, reconnecting in 5s...')
      eventSource.close()
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSourceRef.current = new EventSource(`/api/sse?userId=${userId}`)
        }
      }, 5000)
    }

    return () => {
      eventSource.close()
    }
  }, [userId, handleEvent])
}

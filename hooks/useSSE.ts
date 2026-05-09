// hooks/useSSE.ts
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SSEEvent } from '@/lib/realtime';

export function useSSE(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'connected':
        console.log('[SSE] Connected');
        break;
      case 'work_package.updated':
      case 'work_package.created':
        queryClient.invalidateQueries({ queryKey: ['work-packages'] });
        break;
      case 'notification.new':
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        break;
      case 'member.added':
        queryClient.invalidateQueries({ queryKey: ['members'] });
        break;
      default:
        console.log('[SSE] Unknown event:', event.type);
    }
  }, [queryClient]);

  useEffect(() => {
    if (!userId) return;

    function connect() {
      const eventSource = new EventSource(`/api/sse?userId=${userId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as SSEEvent;
          handleEvent(data);
        } catch (error) {
          console.error('[SSE] Failed to parse event:', error);
        }
      };

      eventSource.onerror = () => {
        console.error('[SSE] Connection error, reconnecting in 5s...');
        eventSource.close();
        reconnectTimeoutRef.current = setTimeout(() => {
          if (eventSourceRef.current === eventSource) {
            connect();
          }
        }, 5000);
      };
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      eventSourceRef.current?.close();
    };
  }, [userId, handleEvent]);
}

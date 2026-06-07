'use client'
// components/realtime/SSEProvider.tsx
// Phase 6 Sprint 1: top-level SSE consumer. Mounted once in pages/_app.tsx
// so every authenticated page subscribes to the user's Redis channel
// `sse:{userId}`. Invalidates React Query caches on `work_package.*` and
// `notification.*` events so the UI updates without polling.
//
// Pre-existing hooks/useSSE.ts is the underlying mechanism — we wrap it
// here so the rest of the app doesn't need to remember to call it.
import { useSession } from 'next-auth/react'
import { useSSE } from '@/hooks/useSSE'

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const userId = (session?.user as { id?: string } | undefined)?.id
  // The hook will no-op if userId is undefined (no EventSource created).
  // It also auto-reconnects on error.
  useSSE(userId)
  return <>{children}</>
}

// components/layout/AuthenticatedLayout.tsx
// v2 compatibility shim — wraps the legacy AuthenticatedLayout API around
// the new AppShell primitive. Pages that still import this file keep
// working unchanged while we migrate them one at a time.
//
// Migration path:
//   1. Replace `import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'`
//      with `import { AppShell } from '@/components/shell'`
//   2. Replace `<AuthenticatedLayout>...</AuthenticatedLayout>` with
//      `<AppShell projectId={...}>...</AppShell>`
//   3. Delete this shim when the search hits zero references.

import React from 'react'
import { AppShell } from '@/components/shell'
import { useAnnouncements } from '@/hooks/use-announcements'
import { useBranding } from '@/hooks/use-branding'
import { useRouter } from 'next/router'
import { AnnouncementBanner } from './AnnouncementBanner'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // P0-A FIX: was `usePathname()` from `next/navigation` which is an App
  // Router API; in Pages Router it always returned `undefined`, silently
  // breaking the projectId extraction below. Now we use `useRouter()`.
  const router = useRouter()
  const pathname = router.pathname
  const { announcements, dismiss } = useAnnouncements()
  const { data: branding } = useBranding()

  const projectId = React.useMemo(() => {
    const match = pathname?.match(/^\/projects\/([^/]+)/)
    return match ? match[1] : undefined
  }, [pathname])

  const primaryColor = branding?.primaryColor || '#1E40AF'

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ '--primary': primaryColor } as React.CSSProperties}
    >
      {announcements.map((announcement) => (
        <AnnouncementBanner
          key={announcement.id}
          announcement={announcement}
          onDismiss={dismiss}
        />
      ))}
      <AppShell projectId={projectId}>{children}</AppShell>
    </div>
  )
}

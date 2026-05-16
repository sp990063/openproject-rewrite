import React from 'react'
import { usePathname } from 'next/navigation'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { AnnouncementBanner } from './AnnouncementBanner'
import { useAnnouncements } from '@/hooks/use-announcements'
import { useBranding } from '@/hooks/use-branding'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const pathname = usePathname()
  const { announcements, dismiss } = useAnnouncements()
  const { data: branding } = useBranding()
  const projectId = React.useMemo(() => {
    const match = pathname?.match(/^\/projects\/([^/]+)/)
    return match ? match[1] : undefined
  }, [pathname])

  const primaryColor = branding?.primaryColor || '#1E40AF'

  return (
    <div className="min-h-screen bg-gray-50" style={{ '--primary': primaryColor } as React.CSSProperties}>
      {announcements.map(announcement => (
        <AnnouncementBanner
          key={announcement.id}
          announcement={announcement}
          onDismiss={dismiss}
        />
      ))}
      <Header />
      <div className="flex">
        <Sidebar projectId={projectId} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

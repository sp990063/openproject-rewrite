import React from 'react'
import { usePathname } from 'next/navigation'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const pathname = usePathname()
  const projectId = React.useMemo(() => {
    const match = pathname?.match(/^\/projects\/([^/]+)/)
    return match ? match[1] : undefined
  }, [pathname])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar projectId={projectId} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

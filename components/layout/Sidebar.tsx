import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Projects', href: '/projects' },
  { label: 'Work Packages', href: '/work-packages' },
  { label: 'Members', href: '/members' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="p-4 hover:bg-gray-100 flex items-center justify-center"
        >
          <svg
            className={cn(
              'w-5 h-5 text-gray-500 transition-transform',
              sidebarCollapsed ? 'rotate-180' : ''
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4">
          <ul className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = pathname?.startsWith(item.href) ?? false
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    {item.icon && <span className="w-5 h-5">{item.icon}</span>}
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </aside>
  )
}

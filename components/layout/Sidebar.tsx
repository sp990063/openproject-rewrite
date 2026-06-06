// components/layout/Sidebar.tsx
// v2 design-system-aligned Sidebar.
// P0 fix: was using `usePathname` from `next/navigation` (App Router API) which
// breaks active-link highlighting in Pages Router. Now uses `useRouter()`.
// P2 fix: replaces 5 inline SVGs with lucide-react icons (style consistency).
// P2 fix: replaces raw slate/gray classes with semantic tokens so dark mode +
// design palette changes propagate automatically.
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  LayoutDashboard,
  Folder,
  ListTodo,
  Activity,
  BookOpen,
  Newspaper,
  MessagesSquare,
  FileText,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/ui/sidebar'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface SidebarProps {
  /** When inside a project, pass projectId to show project-specific nav */
  projectId?: string
}

interface RecentProject {
  id: string
  name: string
  lastVisited: string
}

const RECENT_PROJECTS_KEY = 'recentProjects'
const MAX_RECENT_PROJECTS = 5

function getRecentProjects(): RecentProject[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_PROJECTS_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch {
    return []
  }
}

export function Sidebar({ projectId }: SidebarProps) {
  // P0-A FIX: `usePathname` is an App Router hook; in Pages Router it returns
  // `undefined` so all `isActive` calls resolved to `false` and the active
  // highlight was silently broken. `useRouter()` from `next/router` is the
  // Pages-Router equivalent.
  const router = useRouter()
  const pathname = router.pathname
  const { sidebarCollapsed, toggleSidebar } = useSidebarStore()
  const [recentProjects, setRecentProjects] = React.useState<RecentProject[]>([])

  React.useEffect(() => {
    setRecentProjects(getRecentProjects())
  }, [])

  const mainNavItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Projects', href: '/projects', icon: Folder },
  ]

  const projectNavItems: NavItem[] = projectId
    ? [
        { label: 'Work Packages', href: `/projects/${projectId}/work-packages`, icon: ListTodo },
        { label: 'Activity', href: `/projects/${projectId}/activity`, icon: Activity },
        { label: 'Wiki', href: `/projects/${projectId}/wiki`, icon: BookOpen },
        { label: 'News', href: `/projects/${projectId}/news`, icon: Newspaper },
        { label: 'Forums', href: `/projects/${projectId}/forums`, icon: MessagesSquare },
        { label: 'Documents', href: `/projects/${projectId}/documents`, icon: FileText },
        { label: 'Search', href: `/projects/${projectId}/search`, icon: Search },
        { label: 'Settings', href: `/projects/${projectId}/settings`, icon: Settings },
      ]
    : []

  // Match exact route for top-level items, prefix match for project-scoped items.
  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/projects') {
      return pathname === href
    }
    return pathname?.startsWith(href) ?? false
  }

  return (
    <aside
      className={cn(
        'h-[calc(100vh-4rem)] bg-surface-sidebar border-r border-border-subtle',
        'transition-all duration-300 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
      aria-label="Main navigation"
    >
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'p-4 flex items-center justify-center border-b border-border-divider',
            'hover:bg-surface-sunken active:bg-surface-sunken/80',
            'text-text-muted hover:text-text-default',
            'focus-ring transition-colors duration-fast ease-out'
          )}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin" aria-label="Primary">
          <ul className="space-y-1 px-2">
            {mainNavItems.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md',
                      'text-sm font-medium',
                      'transition-colors duration-fast ease-out',
                      'focus-ring',
                      active
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-100/10 dark:text-primary-300'
                        : 'text-text-muted hover:bg-surface-sunken hover:text-text-default'
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>

          {projectId && projectNavItems.length > 0 && (
            <>
              {!sidebarCollapsed && (
                <div className="px-5 mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Project
                </div>
              )}
              <ul className="space-y-1 px-2">
                {projectNavItems.map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md',
                          'text-sm font-medium',
                          'transition-colors duration-fast ease-out',
                          'focus-ring',
                          active
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-100/10 dark:text-primary-300'
                            : 'text-text-muted hover:bg-surface-sunken hover:text-text-default'
                        )}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {!sidebarCollapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {/* Recent projects (only when expanded) */}
          {!sidebarCollapsed && recentProjects.length > 0 && (
            <>
              <div className="px-5 mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-text-subtle flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Recent
              </div>
              <ul className="space-y-1 px-2">
                {recentProjects.slice(0, MAX_RECENT_PROJECTS).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                        'text-text-muted hover:bg-surface-sunken hover:text-text-default',
                        'focus-ring transition-colors duration-fast ease-out'
                      )}
                    >
                      <span className="truncate">{p.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
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

// ── Icons (inline SVG to avoid icon library dependency) ─────────────────────

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function ProjectsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function WorkPackagesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

function WikiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

function ForumsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function NewsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  )
}

function DocumentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
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
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])

  useEffect(() => {
    setRecentProjects(getRecentProjects())
  }, [])

  const mainNavItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: <DashboardIcon className="w-5 h-5" /> },
    { label: 'Projects', href: '/projects', icon: <ProjectsIcon className="w-5 h-5" /> },
  ]

  // Project-specific navigation items
  const projectNavItems: NavItem[] = projectId
    ? [
        { label: 'Work Packages', href: `/projects/${projectId}/work-packages`, icon: <WorkPackagesIcon className="w-5 h-5" /> },
        { label: 'Activity', href: `/projects/${projectId}/activity`, icon: <ActivityIcon className="w-5 h-5" /> },
        { label: 'Wiki', href: `/projects/${projectId}/wiki`, icon: <WikiIcon className="w-5 h-5" /> },
        { label: 'News', href: `/projects/${projectId}/news`, icon: <NewsIcon className="w-5 h-5" /> },
        { label: 'Forums', href: `/projects/${projectId}/forums`, icon: <ForumsIcon className="w-5 h-5" /> },
        { label: 'Documents', href: `/projects/${projectId}/documents`, icon: <DocumentsIcon className="w-5 h-5" /> },
        { label: 'Search', href: `/projects/${projectId}/search`, icon: <SearchIcon className="w-5 h-5" /> },
        { label: 'Settings', href: `/projects/${projectId}/settings`, icon: <SettingsIcon className="w-5 h-5" /> },
      ]
    : []

  const isActive = (href: string) => pathname?.startsWith(href) ?? false

  return (
    <aside
      className={cn(
        'h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="p-4 hover:bg-gray-100 flex items-center justify-center border-b border-gray-100"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={cn(
              'w-5 h-5 text-gray-500 transition-transform duration-300',
              sidebarCollapsed ? 'rotate-180' : ''
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <nav className="flex-1 overflow-y-auto py-2">
          {/* Recent Projects */}
          {recentProjects.length > 0 && !projectId && (
            <div className="px-2 mb-2">
              {!sidebarCollapsed && (
                <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent</p>
              )}
              <ul className="space-y-0.5">
                {recentProjects.slice(0, MAX_RECENT_PROJECTS).map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive(`/projects/${project.id}`)
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )}
                      title={sidebarCollapsed ? project.name : undefined}
                    >
                      <ClockIcon className="w-5 h-5 flex-shrink-0" />
                      {!sidebarCollapsed && (
                        <span className="truncate">{project.name}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Main navigation */}
          <div className="px-2">
            {!sidebarCollapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Main</p>
            )}
            <ul className="space-y-0.5">
              {mainNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Project-specific navigation */}
          {projectNavItems.length > 0 && (
            <div className="px-2 mt-4">
              {!sidebarCollapsed && (
                <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Project</p>
              )}
              <ul className="space-y-0.5">
                {projectNavItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive(item.href)
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
                      {!sidebarCollapsed && <span>{item.label}</span>}
                      {!sidebarCollapsed && isActive(item.href) && (
                        <ChevronRightIcon />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>
      </div>
    </aside>
  )
}

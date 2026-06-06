// components/shell/Sidebar.tsx
// v2 design system — Application shell Sidebar.
//
// Left-rail navigation. Width is 240px expanded, 64px collapsed; both states
// are driven by the `sidebarCollapsed` flag in stores/ui-store.ts. Active
// link uses bg-primary-100 + text-primary-700 per spec §6.1.
//
// Spec: revamp-v2/design/01-uiux-design.md §6 (Layout & Grid).

'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Package,
  Bell,
  UserCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  /** When true, only highlight this item on an exact match. */
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Work Packages', href: '/work-packages', icon: Package },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'My Page', href: '/my-page', icon: UserCircle },
  { label: 'Help', href: '/help', icon: HelpCircle },
]

export interface SidebarProps {
  /** Optional override for the active pathname. Useful for testing. */
  activePath?: string
}

export function Sidebar({ activePath }: SidebarProps = {}) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const pathname = usePathname()
  const current = activePath ?? pathname ?? ''

  const isActive = (item: NavItem) => {
    if (!current) return false
    if (item.exact) return current === item.href
    // Treat '/' as a prefix of nothing — only count true path starts.
    if (item.href === '/') return current === '/'
    return current === item.href || current.startsWith(`${item.href}/`)
  }

  return (
    <aside
      aria-label="Primary navigation"
      data-collapsed={sidebarCollapsed ? 'true' : 'false'}
      className={cn(
        // Layout
        'flex h-full flex-col border-r border-border-subtle bg-surface-sidebar',
        'transition-[width] duration-200 ease-out',
        // Width: expanded (240px) / collapsed (64px). Use the 64px column
        // on small screens as well so the rail is icon-only on tablets.
        sidebarCollapsed ? 'w-16' : 'w-60',
        'shrink-0'
      )}
      style={{
        // Surface tokens come from globals.css — used here so the sidebar
        // can survive the few pages that still bypass the shell.
        background: 'var(--color-surface-sidebar)',
        color: 'var(--color-text-default)',
      }}
    >
      {/* Spacer under the fixed topbar (56px) — only relevant when the
          sidebar is rendered inside the AppShell flex column. Kept for
          visual breathing room. */}
      <div className="h-2" aria-hidden />

      {/* ── Navigation list ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-md text-sm font-medium',
                    'transition-colors duration-fast ease-out',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                    sidebarCollapsed
                      ? 'h-10 w-10 justify-center mx-auto'
                      : 'h-9 px-3',
                    active
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-text-muted hover:bg-slate-100 hover:text-text-default'
                  )}
                  style={
                    active
                      ? {
                          background: 'var(--color-primary-100)',
                          color: 'var(--color-primary-700)',
                        }
                      : undefined
                  }
                >
                  <Icon
                    className="h-4 w-4 shrink-0"
                    aria-hidden
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  <span className="sr-only">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Collapse toggle (bottom) ──────────────────────────────────── */}
      <div
        className={cn(
          'border-t border-border-subtle p-2',
          sidebarCollapsed ? 'flex justify-center' : 'flex justify-end'
        )}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md',
            'text-text-muted hover:bg-slate-100 hover:text-text-default',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            'transition-colors duration-fast'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </aside>
  )
}

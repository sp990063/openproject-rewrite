// components/shell/AppShell.tsx
// v2 design system — Application shell.
//
// Three-region layout (spec §6.1):
//   ┌─ Topbar (56px, fixed, z-30) ─────────────────────────────────┐
//   ├─ Sidebar (240px / 64px) ───┬─ Main (scrollable) ─────────────┤
//   │                            │                                │
//   │                            │                                │
//   └────────────────────────────┴────────────────────────────────┘
//
// Sidebar collapse state is owned by stores/ui-store.ts so it survives
// route changes. The Topbar and Sidebar are siblings of the scrolling
// <main>; the topbar's 56px height is reserved via the main's top padding
// (pt-14 = 56px).
//
// Spec: revamp-v2/design/01-uiux-design.md §6 (Layout & Grid).

'use client'

import * as React from 'react'
import { useRouter } from 'next/router'
import { Sidebar, type SidebarProps } from './Sidebar'
import { Topbar } from './Topbar'
import { cn } from '@/lib/utils'

export interface AppShellProps {
  /** Page content. */
  children: React.ReactNode
  /** Optional className for the inner main content area. */
  contentClassName?: string
  /**
   * Optional projectId. If omitted, AppShell extracts it from the URL
   * (`/projects/[projectId]/...`) so project-scoped pages automatically
   * get the project nav in the sidebar.
   */
  projectId?: string
}

export function AppShell({
  children,
  contentClassName,
  projectId: projectIdProp,
}: AppShellProps) {
  // Auto-detect projectId from the URL so individual pages don't need to
  // pass it explicitly. The explicit prop wins when both are present.
  const router = useRouter()
  const autoProjectId = React.useMemo(() => {
    const match = router.pathname?.match(/^\/projects\/([^/]+)/)
    return match ? match[1] : undefined
  }, [router.pathname])
  const projectId = projectIdProp ?? autoProjectId

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: 'var(--color-surface-canvas)',
        color: 'var(--color-text-default)',
      }}
    >
      {/* Fixed topbar — sits above everything else (z-30). */}
      <Topbar />

      {/* Body row: sidebar (left) + scrollable main (right).
          The main is pushed down by 56px (pt-14) to clear the fixed topbar. */}
      <div className="flex min-h-screen w-full pt-14">
        <Sidebar projectId={projectId} />
        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          className={cn(
            'flex-1 min-w-0 overflow-x-hidden overflow-y-auto',
            'px-4 py-6 sm:px-6 lg:px-8',
            contentClassName
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

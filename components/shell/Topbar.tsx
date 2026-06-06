// components/shell/Topbar.tsx
// v2 design system — Application shell Topbar.
//
// Fixed-top header (56px per task spec). Three regions:
//   left   — brand mark
//   center — global search input
//   right  — theme toggle + user avatar menu
//
// Spec: revamp-v2/design/01-uiux-design.md §6 (Layout & Grid), §16.4 (Theme
// toggle UI — light / dark / system).

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { signOut, useSession } from 'next-auth/react'
import { Search, Sun, Moon, Bell, User } from 'lucide-react'
import { useTheme, type Theme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

export function Topbar() {
  const router = useRouter()
  const { data: session } = useSession()
  const { theme, setTheme, resolvedTheme } = useTheme()

  const userName = session?.user?.name ?? session?.user?.email ?? 'Account'
  const userInitial = userName.trim().charAt(0).toUpperCase() || 'U'

  // ── Menu open/close state ──────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Cycle light → dark → system → light on each click. We pick the *current
  // resolvedTheme* as the starting point so the icon is always meaningful.
  const cycleTheme = React.useCallback(() => {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme)
    const next = order[(idx + 1) % order.length]
    setTheme(next)
  }, [theme, setTheme])

  const ThemeIcon = resolvedTheme === 'dark' ? Moon : Sun
  const themeLabel =
    theme === 'system'
      ? `System theme (currently ${resolvedTheme})`
      : theme === 'dark'
        ? 'Dark theme'
        : 'Light theme'

  return (
    <header
      role="banner"
      className={cn(
        'fixed inset-x-0 top-0 z-30 h-14',
        'flex items-center gap-4 px-4',
        'border-b border-border-subtle bg-surface-topbar',
        'backdrop-blur supports-[backdrop-filter]:bg-surface-topbar/95'
      )}
      style={{
        background: 'var(--color-surface-topbar)',
        color: 'var(--color-text-default)',
        height: 56,
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 font-semibold text-text-default"
        aria-label="OpenProject home"
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-onPrimary"
          style={{ background: 'var(--color-primary-600)' }}
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 7l8-4 8 4-8 4-8-4z" />
            <path d="M4 12l8 4 8-4" />
            <path d="M4 17l8 4 8-4" />
          </svg>
        </span>
        <span className="hidden text-base sm:inline">OpenProject</span>
      </Link>

      {/* ── Search (center) ───────────────────────────────────────────── */}
      <div className="flex flex-1 justify-center">
        <form
          role="search"
          className="w-full max-w-xl"
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            const q = String(data.get('q') ?? '').trim()
            if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
          }}
        >
          <label className="relative block">
            <span className="sr-only">Search OpenProject</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              placeholder="Search projects, work packages, people…"
              className={cn(
                'h-9 w-full rounded-md border border-border-subtle bg-surface-sunken pl-9 pr-3 text-sm',
                'placeholder:text-text-subtle text-text-default',
                'focus:outline-none focus:ring-2 focus:ring-border-ring focus:border-border-focus',
                'transition-shadow duration-fast'
              )}
              style={{ background: 'var(--color-surface-sunken)' }}
            />
          </label>
        </form>
      </div>

      {/* ── Right cluster ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* Notifications shortcut */}
        <Link
          href="/notifications"
          aria-label="Notifications"
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md',
            'text-text-muted hover:bg-slate-100 hover:text-text-default',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            'transition-colors duration-fast'
          )}
        >
          <Bell className="h-4 w-4" aria-hidden />
        </Link>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={cycleTheme}
          aria-label={`Switch theme (${themeLabel})`}
          title={themeLabel}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md',
            'text-text-muted hover:bg-slate-100 hover:text-text-default',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            'transition-colors duration-fast'
          )}
        >
          <ThemeIcon className="h-4 w-4" aria-hidden />
          <span className="sr-only">{themeLabel}</span>
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full',
              'bg-primary-600 text-text-onPrimary text-sm font-semibold',
              'hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              'transition-colors duration-fast'
            )}
            style={{ background: 'var(--color-primary-600)' }}
          >
            {userInitial}
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="Account"
              className={cn(
                'absolute right-0 mt-2 w-56 origin-top-right rounded-md',
                'border border-border-subtle bg-surface-raised shadow-lg',
                'py-1 text-sm text-text-default',
                'z-40'
              )}
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-default)',
              }}
            >
              <div className="px-3 py-2 border-b border-border-subtle">
                <p className="truncate font-medium">{userName}</p>
                {session?.user?.email && userName !== session.user.email && (
                  <p className="truncate text-xs text-text-muted">
                    {session.user.email}
                  </p>
                )}
              </div>
              <Link
                href="/my-page"
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100"
                onClick={() => setMenuOpen(false)}
              >
                <User className="h-4 w-4" aria-hidden />
                My Page
              </Link>
              <div className="my-1 border-t border-border-subtle" />
              <button
                type="button"
                role="menuitem"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left',
                  'hover:bg-slate-100 focus:bg-slate-100 focus:outline-none'
                )}
                onClick={() => {
                  setMenuOpen(false)
                  // Best-effort sign-out; ignore errors.
                  signOut({ callbackUrl: '/login' }).catch(() => undefined)
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

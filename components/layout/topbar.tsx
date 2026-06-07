// components/layout/topbar.tsx
// v2 design system — App topbar with theme switcher (spec §11 + §16)
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import {
  Bell,
  Search,
  User as UserIcon,
  LogOut,
  Moon,
  Sun,
  Monitor,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'

import { useTheme, type Theme } from '@/components/theme-provider'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { useRouter } from 'next/router'
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete'
import { cn } from '@/lib/utils'

// ─── Theme Switcher ────────────────────────────────────────────────────────

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') return <Moon className="size-4" aria-hidden />
  if (theme === 'light') return <Sun className="size-4" aria-hidden />
  return <Monitor className="size-4" aria-hidden />
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const options: { value: Theme; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'system', label: 'System', Icon: Monitor },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Theme: ${theme}. Click to change.`}
          className={cn(
            'inline-flex items-center justify-center',
            'h-9 w-9 rounded-md',
            'text-text-muted hover:text-text-default',
            'hover:bg-surface-sunken active:bg-surface-sunken/80',
            'dark:hover:bg-surface-sunken dark:active:bg-surface-sunken/80',
            'focus-ring transition-colors duration-fast ease-out'
          )}
        >
          <ThemeIcon theme={theme} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            className={cn(
              'flex items-center gap-2',
              theme === value && 'bg-surface-sunken text-text-default font-medium dark:bg-surface-sunken'
            )}
          >
            <Icon className="size-4 text-text-muted" />
            <span>{label}</span>
            {theme === value && (
              <span aria-hidden className="ml-auto text-primary">
                •
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── User Avatar Menu ──────────────────────────────────────────────────────

function UserMenu() {
  const { data: session } = useSession()
  const user = session?.user

  if (!user) {
    return (
      <Link href="/login">
        <Button variant="primary" size="sm">
          Sign in
        </Button>
      </Link>
    )
  }

  const initials =
    (user.name?.match(/\b\w/g) ?? [])
      .slice(0, 2)
      .join('')
      .toUpperCase() ||
    user.email?.charAt(0).toUpperCase() ||
    'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open user menu"
          className={cn(
            'inline-flex items-center gap-2',
            'h-9 px-2 rounded-md',
            'text-text-default hover:bg-surface-sunken active:bg-surface-sunken/80',
            'dark:hover:bg-surface-sunken dark:active:bg-surface-sunken/80',
            'focus-ring transition-colors duration-fast ease-out'
          )}
        >
          <span
            aria-hidden
            className={cn(
              'flex items-center justify-center',
              'size-7 rounded-full',
              'bg-primary text-text-onPrimary text-xs font-semibold'
            )}
          >
            {initials}
          </span>
          <span className="hidden md:inline-block text-sm font-medium max-w-[10rem] truncate">
            {user.name ?? user.email}
          </span>
          <ChevronDown className="size-4 text-text-muted" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium text-text-default truncate">
            {user.name ?? 'User'}
          </p>
          {user.email && (
            <p className="text-xs text-text-muted truncate">{user.email}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => (window.location.href = '/my-page')}>
          <UserIcon className="mr-2 size-4" />
          My page
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => (window.location.href = '/settings')}>
          <span className="mr-2 size-4 inline-block" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: '/login' })}>
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Search Box ────────────────────────────────────────────────────────────

function GlobalSearch() {
  // Sprint 5 fix: wire the previously-styled-only input to the real
  // SearchAutocomplete component. Pressing Enter (or selecting a
  // suggestion / recent) navigates to /search?q=... for full results.
  const router = useRouter()
  const [value, setValue] = React.useState('')

  return (
    <div className="relative flex-1 max-w-xl">
      <SearchAutocomplete
        value={value}
        onChange={setValue}
        onSearch={(q) => {
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`)
        }}
        placeholder="Search projects, work packages, users…  (Press / to focus)"
        className="w-full"
      />
    </div>
  )
}

// ─── Notification Bell ─────────────────────────────────────────────────────

function NotificationButton() {
  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className={cn(
        'relative inline-flex items-center justify-center',
        'h-9 w-9 rounded-md',
        'text-text-muted hover:text-text-default',
        'hover:bg-surface-sunken active:bg-surface-sunken/80',
        'dark:hover:bg-surface-sunken dark:active:bg-surface-sunken/80',
        'focus-ring transition-colors duration-fast ease-out'
      )}
    >
      <Bell className="size-4" />
      {/* Unread indicator dot — wire to real unread count in a future commit */}
      <span
        aria-hidden
        className="absolute top-2 right-2 size-1.5 rounded-full bg-error"
      />
    </Link>
  )
}

// ─── Topbar ────────────────────────────────────────────────────────────────

export interface TopbarProps {
  logo?: React.ReactNode
  brandName?: string
  onToggleMobileNav?: () => void
  isMobileNavOpen?: boolean
}

export function Topbar({
  logo,
  brandName = 'OpenProject',
  onToggleMobileNav,
  isMobileNavOpen = false,
}: TopbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-topbar',
        'h-14 w-full',
        'bg-topbar border-b border-border-subtle',
        'flex items-center gap-3 px-4 md:px-6'
      )}
    >
      {/* Mobile menu toggle */}
      {onToggleMobileNav && (
        <button
          type="button"
          aria-label={isMobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileNavOpen}
          onClick={onToggleMobileNav}
          className={cn(
            'md:hidden inline-flex items-center justify-center',
            'h-9 w-9 rounded-md',
            'text-text-muted hover:text-text-default',
            'hover:bg-surface-sunken active:bg-surface-sunken/80',
            'dark:hover:bg-surface-sunken dark:active:bg-surface-sunken/80',
            'focus-ring'
          )}
        >
          {isMobileNavOpen ? (
            <X className="size-4" />
          ) : (
            <Menu className="size-4" />
          )}
        </button>
      )}

      {/* Logo + brand */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 mr-2 focus-ring rounded-md"
      >
        {logo ?? (
          <span
            aria-hidden
            className="flex items-center justify-center size-7 rounded-md bg-primary text-text-onPrimary"
          >
            <svg
              viewBox="0 0 40 40"
              className="size-4"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M10 28L20 12L30 28H10Z" fill="currentColor" fillOpacity="0.9" />
              <circle cx="20" cy="22" r="3" fill="currentColor" />
            </svg>
          </span>
        )}
        <span className="hidden sm:inline-block text-sm font-semibold text-text-default">
          {brandName}
        </span>
      </Link>

      {/* Global search */}
      <div className="hidden md:flex flex-1 justify-center">
        <GlobalSearch />
      </div>

      {/* Spacer on mobile so right-side icons hug the edge */}
      <div className="flex-1 md:hidden" />

      {/* Right-side actions */}
      <div className="flex items-center gap-1">
        <div className="md:hidden">
          <Link
            href="/search"
            aria-label="Search"
            className={cn(
              'inline-flex items-center justify-center',
              'h-9 w-9 rounded-md',
              'text-text-muted hover:text-text-default',
              'hover:bg-surface-sunken active:bg-surface-sunken/80',
              'dark:hover:bg-surface-sunken dark:active:bg-surface-sunken/80',
              'focus-ring'
            )}
          >
            <Search className="size-4" />
          </Link>
        </div>
        <NotificationButton />
        <ThemeSwitcher />
        <UserMenu />
      </div>
    </header>
  )
}

export default Topbar

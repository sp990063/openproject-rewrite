// components/theme-provider.tsx
// v2 design system — Theme Provider (light / dark / system)
// Spec §16 — Theme Switching & Dark Mode

'use client'

import * as React from 'react'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'op-rewrite-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyThemeClass(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  // Hint to the browser which color-scheme to use for native UI
  root.style.colorScheme = resolved
}

interface ThemeProviderProps {
  children: React.ReactNode
  /** Optional default theme. Defaults to "system". */
  defaultTheme?: Theme
  /** Optional storage key. Defaults to "op-rewrite-theme". */
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = STORAGE_KEY,
}: ThemeProviderProps) {
  // Always start with the default to keep SSR/CSR markup in sync.
  // The actual stored preference is read and applied in the effect below.
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] =
    React.useState<'light' | 'dark'>('light')

  // ── Initial load: read storage and apply the class. ─────────────────────
  React.useEffect(() => {
    let stored: Theme | null = null
    try {
      stored = window.localStorage.getItem(storageKey) as Theme | null
    } catch {
      // localStorage may be disabled (private mode, sandboxed iframe)
    }
    const initial: Theme = stored ?? defaultTheme
    const resolved =
      initial === 'system' ? getSystemTheme() : initial
    setThemeState(initial)
    setResolvedTheme(resolved)
    applyThemeClass(resolved)
  }, [defaultTheme, storageKey])

  // ── Track system preference changes while in "system" mode. ────────────
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      setThemeState((current) => {
        if (current === 'system') {
          const next = mq.matches ? 'dark' : 'light'
          setResolvedTheme(next)
          applyThemeClass(next)
        }
        return current
      })
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = React.useCallback(
    (next: Theme) => {
      setThemeState(next)
      try {
        window.localStorage.setItem(storageKey, next)
      } catch {
        /* ignore */
      }
      const resolved = next === 'system' ? getSystemTheme() : next
      setResolvedTheme(resolved)
      applyThemeClass(resolved)
    },
    [storageKey]
  )

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>')
  }
  return ctx
}

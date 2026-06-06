// components/shell/index.ts
// Barrel export for the v2 application shell.
//
// Consumers should import from "@/components/shell" rather than reaching
// into individual files. ThemeProvider lives in '@/components/theme-provider'
// to keep a single source of truth (the v1 theme-provider.tsx is the
// canonical implementation; shell/ThemeProvider.tsx was deleted in the P0-B
// unification pass).
export { AppShell } from './AppShell'
export type { AppShellProps } from './AppShell'

export { Topbar } from './Topbar'

export { Sidebar } from './Sidebar'
export type { SidebarProps } from './Sidebar'

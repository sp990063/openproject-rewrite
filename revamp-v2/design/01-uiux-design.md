# OpenProject Rewrite — UI/UX Design Specification (v2)

**Version:** 2.0
**Status:** Approved for implementation
**Audience:** Frontend engineers, designers, PMs
**Tech baseline:** Next.js 15 (Pages Router), Tailwind CSS v4, Radix UI primitives, lucide-react
**Last updated:** 2026-06-06

---

## Table of Contents

1. [Vision & Principles](#1-vision--principles)
2. [Design Tokens (Foundations)](#2-design-tokens-foundations)
3. [Theme & Color System](#3-theme--color-system)
4. [Typography](#4-typography)
5. [Spacing, Radius, Elevation](#5-spacing-radius-elevation)
6. [Layout & Grid System](#6-layout--grid-system)
7. [Iconography](#7-iconography)
8. [Component Library](#8-component-library)
9. [Motion & Microinteractions](#9-motion--microinteractions)
10. [Accessibility (WCAG 2.1 AA)](#10-accessibility-wcag-21-aa)
11. [Page-by-Page Wireframes (52 pages)](#11-page-by-page-wireframes)
12. [State Diagrams](#12-state-diagrams)
13. [Loading, Empty, Error States](#13-loading-empty-error-states)
14. [Mobile Responsive Strategy](#14-mobile-responsive-strategy)
15. [Tailwind v4 Implementation Guide](#15-tailwind-v4-implementation-guide)
16. [Theme Switching & Dark Mode](#16-theme-switching--dark-mode)
17. [Comparison: Original OpenProject vs Rewrite v2](#17-comparison-original-openproject-vs-rewrite-v2)
18. [Recommended New Pages](#18-recommended-new-pages-beyond-52)
19. [Appendix: Code Patterns & Snippets](#19-appendix-code-patterns--snippets)

---

## 1. Vision & Principles

### 1.1 Product positioning

OpenProject Rewrite is a **modern, opinionated, density-aware project management tool** that respects the data-heavy reality of PM work (hundreds of work packages, dozens of projects, multi-week Gantt horizons) without feeling like a 2010-era enterprise tool. It is the **fast path** to the OpenProject feature set for teams that want Rails-grade feature depth with SaaS-grade polish.

### 1.2 Five design principles (ranked by priority)

| # | Principle | What it means in practice |
|---|-----------|----------------------------|
| 1 | **Density is a feature, not a bug** | Information workers need to see *more*, not less. We refuse to wrap-ify tables, force-feed cards, or hide filters behind drawers. Table rows are 32px; toolbar is 48px; sidebar is 240px / 64px (collapsed). |
| 2 | **The page should never blank** | Every route renders meaningful content within 200ms. Skeletons are exact-shape, not shimmer. Optimistic updates for all create/edit/delete actions. |
| 3 | **Keyboard-first power user** | Every primary action is reachable from the keyboard. `/` to focus search, `g p` for projects, `c` to create WP, `?` for cheat sheet. The Rails-era "click 9 menus" anti-pattern is gone. |
| 4 | **The brand is calm** | We use a single saturated hue (Indigo-600) for primary actions and lean on neutrals + one semantic hue per state. No rainbow status pills. The dashboard is not a leaderboard. |
| 5 | **Progressive disclosure, never modal lock-in** | A drawer over a row, a popover over a cell, a side-panel for WP detail — modals are reserved for true confirm/destroy flows. The WP detail page is **not** a modal; it has a URL. |

### 1.3 Anti-patterns we explicitly reject

- Modal-only "drawer-everything" SaaS layouts that hide the list
- "Friendly" empty states with 200px illustrations and one CTA, when 3px of chrome + the data would do
- Pagination when infinite scroll or a virtualized list is the right answer
- Status pills that look like gemstones (Status: 🟣🟢🟡🔴)
- Icon-only icon buttons in toolbars (we always pair with a label or tooltip)
- Spinners in place of skeletons for known-shape content

---

## 2. Design Tokens (Foundations)

All design decisions flow from a single source of truth: CSS custom properties defined in `styles/globals.css` and exposed to Tailwind v4 via `@theme inline { ... }`. **No hard-coded values** in components.

### 2.1 Token naming convention

We follow the W3C Design Tokens Community Group format, slightly flattened for utility-class consumption:

```
--color-{role}-{step}      e.g. --color-primary-600
--color-{role}-{subrole}   e.g. --color-surface-canvas, --color-text-muted
--font-{family}-{variant}  e.g. --font-sans, --font-mono
--text-{size}              e.g. --text-sm
--leading-{step}           e.g. --leading-tight
--space-{n}                e.g. --space-4   (multiples of 4)
--radius-{step}            e.g. --radius-md
--shadow-{step}            e.g. --shadow-sm
--duration-{step}          e.g. --duration-fast
--ease-{name}              e.g. --ease-out
--z-{step}                 e.g. --z-modal
```

### 2.2 Token table (summary)

The full token block lives in §15. A summary of what exists:

- **8 color roles** × 11 steps = 88 base color tokens
- **6 surface tokens** (canvas, raised, sunken, overlay, sidebar, topbar)
- **6 text tokens** (default, muted, subtle, onPrimary, onAccent, link)
- **6 border tokens** (subtle, default, strong, focus, divider, ring)
- **7 text sizes** (xs/sm/base/lg/xl/2xl/3xl) + display
- **5 line-height steps**
- **9 spacing steps** (0, 1, 2, 3, 4, 6, 8, 12, 16, 24) in 4px multiples
- **5 radius steps** (none/sm/md/lg/full)
- **5 shadow steps** (xs/sm/md/lg/xl)
- **4 duration steps** (instant/fast/base/slow) + 2 easings
- **8 z-index steps**

---

## 3. Theme & Color System

### 3.1 Color philosophy

We use the **Indigo + Slate** palette: Indigo is the brand hue, Slate is the neutral spine. Semantic colors (success/warning/error/info) are muted desaturated tones — they communicate state, they do not shout. All semantic colors are tested at AA contrast against their paired background and against both light/dark surfaces.

### 3.2 Primary palette (Indigo)

Indigo 600 is the brand color. We do not use Indigo 500 for interactive elements (insufficient contrast on hover), we do not use 700+ for backgrounds (visually heavy).

| Token | Light hex | Dark hex | Use |
|-------|-----------|----------|-----|
| `--color-primary-50`  | `#EEF2FF` | `#1E1B4B` | Subtle hover, selected row |
| `--color-primary-100` | `#E0E7FF` | `#312E81` | Hover bg, badge bg |
| `--color-primary-200` | `#C7D2FE` | `#3730A3` | Decorative |
| `--color-primary-300` | `#A5B4FC` | `#4338CA` | Focus ring inner |
| `--color-primary-400` | `#818CF8` | `#4F46E5` | Decorative, chart 2nd |
| `--color-primary-500` | `#6366F1` | `#6366F1` | **Brand mark only** |
| `--color-primary-600` | `#4F46E5` | `#818CF8` | **Primary action** (Light bg) / **Brand mark** (Dark bg) |
| `--color-primary-700` | `#4338CA` | `#A5B4FC` | Hover/active (Light) |
| `--color-primary-800` | `#3730A3` | `#C7D2FE` | Strong text (Light) |
| `--color-primary-900` | `#312E81` | `#E0E7FF` | Strongest text (Light) |

### 3.3 Neutral palette (Slate)

| Token | Light hex | Dark hex |
|-------|-----------|----------|
| `--color-slate-0`   | `#FFFFFF` | `#0B0F1A` |
| `--color-slate-50`  | `#F8FAFC` | `#0F172A` |
| `--color-slate-100` | `#F1F5F9` | `#1E293B` |
| `--color-slate-200` | `#E2E8F0` | `#334155` |
| `--color-slate-300` | `#CBD5E1` | `#475569` |
| `--color-slate-400` | `#94A3B8` | `#64748B` |
| `--color-slate-500` | `#64748B` | `#94A3B8` |
| `--color-slate-600` | `#475569` | `#CBD5E1` |
| `--color-slate-700` | `#334155` | `#E2E8F0` |
| `--color-slate-800` | `#1E293B` | `#F1F5F9` |
| `--color-slate-900` | `#0F172A` | `#F8FAFC` |
| `--color-slate-950` | `#020617` | `#FFFFFF` |

### 3.4 Semantic palette

| Role | Light 600 (action) | Light 100 (bg) | Light 700 (text) | Dark 600 | Dark 100 | Dark 700 |
|------|-------------------:|---------------:|-----------------:|---------:|---------:|---------:|
| **Success** | `#16A34A` | `#DCFCE7` | `#15803D` | `#4ADE80` | `#052E16` | `#86EFAC` |
| **Warning** | `#D97706` | `#FEF3C7` | `#B45309` | `#FBBF24` | `#451A03` | `#FCD34D` |
| **Error**   | `#DC2626` | `#FEE2E2` | `#B91C1C` | `#F87171` | `#450A0A` | `#FCA5A5` |
| **Info**    | `#0284C7` | `#E0F2FE` | `#0369A1` | `#38BDF8` | `#082F49` | `#7DD3FC` |

**WCAG verification (light mode):**
- Primary 600 on white: 5.93:1 ✓ AA Large + AA Normal
- Slate 600 on white: 7.26:1 ✓ AAA
- Success 700 on Success 100: 5.51:1 ✓ AA
- Error 700 on Error 100: 6.32:1 ✓ AA

### 3.5 Surfaces (semantic)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--color-surface-canvas` | `--color-slate-50` | `--color-slate-950` | App background |
| `--color-surface-raised` | `#FFFFFF` | `--color-slate-900` | Cards, popovers |
| `--color-surface-sunken` | `--color-slate-100` | `--color-slate-950` | Inset, code blocks |
| `--color-surface-overlay` | `rgba(15,23,42,0.6)` | `rgba(0,0,0,0.7)` | Modal scrim |
| `--color-surface-sidebar` | `#FFFFFF` | `--color-slate-900` | Left nav |
| `--color-surface-topbar` | `#FFFFFF` | `--color-slate-900` | Header |

### 3.6 Text (semantic)

| Token | Light | Dark | AA on canvas? |
|-------|-------|------|---------------|
| `--color-text-default` | `--color-slate-900` | `--color-slate-50` | ✓ 17.4:1 / 17.0:1 |
| `--color-text-muted` | `--color-slate-600` | `--color-slate-400` | ✓ 7.3:1 / 7.4:1 |
| `--color-text-subtle` | `--color-slate-500` | `--color-slate-500` | ✓ 4.8:1 / 4.8:1 (AA only) |
| `--color-text-onPrimary` | `#FFFFFF` | `#FFFFFF` | ✓ on Primary 600 |
| `--color-text-link` | `--color-primary-700` | `--color-primary-300` | ✓ |
| `--color-text-inverse` | `#FFFFFF` | `--color-slate-900` | for inverse surfaces |

### 3.7 Borders (semantic)

| Token | Light | Dark |
|-------|-------|------|
| `--color-border-subtle` | `--color-slate-200` | `--color-slate-800` |
| `--color-border-default` | `--color-slate-300` | `--color-slate-700` |
| `--color-border-strong` | `--color-slate-400` | `--color-slate-600` |
| `--color-border-focus` | `--color-primary-600` | `--color-primary-400` |
| `--color-border-divider` | `--color-slate-100` | `--color-slate-800` |

### 3.8 Status color tokens (work package + project status)

We do **not** use the rainbow status-pill approach. Instead each status gets a *named role* with a 600 fill and a 100 surface. Same pattern as semantic colors.

| Status | Token name | Light 600 | Light 100 | Comment |
|--------|-----------|----------:|----------:|---------|
| New | `--color-status-new` | `#64748B` | `#F1F5F9` | Slate |
| In progress | `--color-status-in-progress` | `#2563EB` | `#DBEAFE` | Blue |
| In review | `--color-status-in-review` | `#9333EA` | `#F3E8FF` | Violet |
| Done | `--color-status-done` | `#16A34A` | `#DCFCE7` | Green |
| Closed | `--color-status-closed` | `#0F172A` | `#E2E8F0` | Slate-900 |
| On hold | `--color-status-on-hold` | `#D97706` | `#FEF3C7` | Amber |
| Rejected | `--color-status-rejected` | `#DC2626` | `#FEE2E2` | Red |

Priorities (low/medium/high/urgent) use the same 4 hues from the semantic palette: `success` / `info` / `warning` / `error`.

---

## 4. Typography

### 4.1 Font stacks

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
--font-display: "Inter Display", "Inter", -apple-system, sans-serif; /* loaded when webfont available */
```

**Rationale:** Inter for UI is industry standard, has tabular numerals (critical for tables), and a wide weight range. JetBrains Mono for code blocks in wiki and technical fields. We **never** use a serif font in the app shell — that is reserved for the docs site only.

### 4.2 Type scale

| Token | Size | Line-height | Weight | Letter-spacing | Use |
|-------|-----:|------------:|-------:|---------------:|-----|
| `--text-display-lg` | 48px / 3rem | 1.1 | 700 | -0.02em | Marketing / login hero only |
| `--text-display`    | 36px / 2.25rem | 1.15 | 700 | -0.02em | Empty-state headlines |
| `--text-3xl`        | 30px / 1.875rem | 1.2 | 700 | -0.015em | Page titles (project header) |
| `--text-2xl`        | 24px / 1.5rem | 1.25 | 600 | -0.01em | Section headings (h2) |
| `--text-xl`         | 20px / 1.25rem | 1.3 | 600 | -0.005em | h3, card titles |
| `--text-lg`         | 18px / 1.125rem | 1.4 | 500 | 0 | h4, lead paragraph |
| `--text-base`       | 16px / 1rem | 1.5 | 400 | 0 | Body |
| `--text-sm`         | 14px / 0.875rem | 1.43 | 400 | 0 | **Default UI** (form labels, table cells) |
| `--text-xs`         | 12px / 0.75rem | 1.33 | 500 | 0.01em | Captions, helper text, badges |
| `--text-2xs`        | 11px / 0.6875rem | 1.27 | 600 | 0.04em | **UPPERCASE labels** (eyebrow text, section tags) |

### 4.3 Heading hierarchy

| Level | Token | Tailwind class | When |
|-------|-------|----------------|------|
| h1 | `--text-3xl` | `text-3xl font-bold tracking-tight` | One per page (page title) |
| h2 | `--text-2xl` | `text-2xl font-semibold tracking-tight` | Section breaks inside a page |
| h3 | `--text-xl`  | `text-xl font-semibold` | Card titles, dialog titles |
| h4 | `--text-lg`  | `text-lg font-medium` | Subsection |
| h5 | `--text-base` | `text-base font-semibold uppercase tracking-wide text-text-muted` | Eyebrow |
| h6 | `--text-sm`  | `text-sm font-semibold` | Form section labels |

### 4.4 Body styles

- **Default body**: 14px (`text-sm`) at 1.43 line-height. This is the workhorse — we do not use 16px for general UI text; the rows feel chunky.
- **Reading body** (wiki, news, forum posts, long descriptions): 16px (`text-base`) at 1.6. Wraps at 72ch.
- **Table body**: 13px (`text-xs`-on-`sm`-default), tabular numerals (`font-variant-numeric: tabular-nums`).
- **Code**: 13px JetBrains Mono, no syntax highlighting in inline code (use Shiki for blocks).

### 4.5 Numeric & tabular figures

All tables, Gantt durations, and date columns set `font-variant-numeric: tabular-nums`. This is included in the `.tabular` utility class (§15.4).

---

## 5. Spacing, Radius, Elevation

### 5.1 Spacing scale

8px-base scale, plus 4px micro-step. Tailwind's default `p-1 … p-8` maps cleanly.

| Token | px | rem | Common use |
|-------|---:|----:|------------|
| `--space-0`  | 0 | 0 | Reset |
| `--space-1`  | 4 | 0.25 | Icon-to-text gap, badge padding-y |
| `--space-2`  | 8 | 0.5 | Default inline gap, button padding-x |
| `--space-3`  | 12 | 0.75 | Input padding-x, card padding-y (tight) |
| `--space-4`  | 16 | 1 | Card padding, form field gap |
| `--space-6`  | 24 | 1.5 | Section gap inside a page |
| `--space-8`  | 32 | 2 | Major section break, modal padding |
| `--space-12` | 48 | 3 | Page top margin, hero padding |
| `--space-16` | 64 | 4 | Dashboard widget gutter (wide screens) |
| `--space-24` | 96 | 6 | Marketing-only |

**Density rule:** we never use a spacing value that is not in this table. `space-5` (20px) is forbidden — pick 4 or 6.

### 5.2 Border radius

| Token | px | Use |
|-------|---:|-----|
| `--radius-none` | 0 | Tables, code blocks |
| `--radius-sm`   | 4 | Badges, small chips, checkboxes |
| `--radius-md`   | 6 | **Default** — buttons, inputs, cards |
| `--radius-lg`   | 8 | Modals, large cards, popovers |
| `--radius-xl`   | 12 | Drawer top corners (mobile sheet) |
| `--radius-full` | 9999 | Avatars, pill badges, toggle switches |

### 5.3 Elevation

We use **5 shadow steps**, each tested for visibility on both white and dark surfaces.

| Token | Definition | Use |
|-------|-----------|-----|
| `--shadow-xs` | `0 1px 2px 0 rgb(0 0 0 / 0.04)` | Hairline border replacement, button pressed |
| `--shadow-sm` | `0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05)` | Card default, dropdown |
| `--shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)` | Popover, hover card |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.05)` | Modal, drawer |
| `--shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.05)` | Sticky command palette |
| `--shadow-ring` | `0 0 0 3px rgb(99 102 241 / 0.25)` | Focus ring outer halo (combined with outline) |

**Dark mode note:** shadows look wrong on dark surfaces. We use `rgb(0 0 0 / 0.5)` shadows in dark mode and lean more on borders (`border-slate-800`) for separation.

---

## 6. Layout & Grid System

### 6.1 Application shell

```
┌─────────────────────────────────────────────────────────────────┐
│ Topbar                              64px, sticky, z-30          │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                          │
│ Side │  Page header (breadcrumb + title + actions)  56-72px    │
│ bar  │ ─────────────────────────────────────────────────────    │
│ 240  │                                                          │
│ (or  │  Page body                                                │
│  64  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│ col- │  Content surface                                          │
│ laps │                                                          │
│ ed)  │                                                          │
│      │                                                          │
│      │                                                          │
│      │                                                          │
└──────┴──────────────────────────────────────────────────────────┘
        ↑                       ↑                          ↑
   min-h-screen           max-w-screen-2xl           p-6 / p-8
   bg-canvas               mx-auto                    responsive
```

### 6.2 Breakpoints

| Name | Min width | Tailwind | Use |
|------|----------:|----------|-----|
| **Mobile** | 0 | (default) | Single column, hamburger nav, bottom sheet drawers |
| **sm** | 640 | `sm:` | 2-column lists, larger tap targets |
| **Tablet** (md) | 768 | `md:` | Sidebar still collapsed (icon-only), 2-3 col grids |
| **Desktop** (lg) | 1024 | `lg:` | Full sidebar (240px), 12-col grid, 3+ col grids |
| **Wide** (xl) | 1280 | `xl:` | Larger gutters, side-by-side panels |
| **2xl** | 1536 | `2xl:` | Max content width 1440px, 4-col dashboard |

### 6.3 Grid rules

- **12-column grid** with `gap-6` (24px) on desktop, `gap-4` on tablet, `gap-3` on mobile.
- Container max width: `max-w-screen-2xl` (1536px) with auto-centering and `px-6` outer gutter.
- Page body horizontal padding: `px-4 sm:px-6 lg:px-8`.
- Page body vertical padding: `py-6 lg:py-8`.

### 6.4 Common grid recipes

| Pattern | Classes |
|---------|---------|
| Page header (breadcrumb + actions) | `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between` |
| Two-column form (label + input) | `grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3` |
| Dashboard widget 12-col | `grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` |
| Settings sidebar + content | `grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]` |
| WP detail (activity + sidebar) | `grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]` |

### 6.5 Z-index scale

| Layer | Token | Value | Use |
|-------|-------|------:|-----|
| Base | `--z-base` | 0 | Document flow |
| Raised | `--z-raised` | 10 | Sticky table headers, dropdown triggers |
| Sticky | `--z-sticky` | 20 | Topbar |
| Drawer | `--z-drawer` | 30 | Side drawer |
| Dropdown | `--z-dropdown` | 40 | Popovers, menus |
| Modal scrim | `--z-modal` | 50 | Modal backdrop |
| Modal | `--z-modal-content` | 51 | Modal box |
| Toast | `--z-toast` | 60 | Notifications |
| Tooltip | `--z-tooltip` | 70 | Always on top |

---

## 7. Iconography

### 7.1 Library

**Primary:** `lucide-react` (already in `package.json`).
**No** emojis as UI icons. **No** icon-only buttons without a label or `aria-label`.

### 7.2 Sizing & stroke

| Token | Size | Stroke | Use |
|-------|-----:|-------:|-----|
| Icon xs | 12 | 2 | Inline with 12px text, badges |
| Icon sm | 14 | 2 | Inline with 14px text, table cells, button-label icons |
| Icon md | 16 | 2 | **Default**, inline with 16px text, button-only |
| Icon lg | 20 | 1.75 | Topbar, prominent UI |
| Icon xl | 24 | 1.75 | Empty state, hero |
| Icon 2xl | 32 | 1.5 | Marketing |

**Rule:** Stroke width scales inversely with size. We never mix stroke widths in the same view.

### 7.3 Iconography catalogue (initial)

These are the icons we will use most often; each maps to a semantic role:

```
navigation:
  LayoutDashboard, FolderKanban, ListChecks, Calendar, GanttChart, BarChart3,
  Users, MessageSquare, FileText, Bell, Settings, Search, Plus, ChevronDown,
  ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal, ArrowLeft, ArrowRight

actions:
  Plus, X, Check, Pencil, Trash2, Save, Send, Copy, Download, Upload,
  Share2, Link2, ExternalLink, Filter, SortAsc, SortDesc, RefreshCw, Loader2

status / state:
  Circle, CircleDot, CircleCheck, CircleAlert, CircleX, AlertTriangle,
  Info, Eye, EyeOff, Lock, Unlock, Pin, Star, Heart, Bookmark

work-package:
  Bug, GitBranch, GitPullRequest, BookOpen, Box, Boxes, Wrench, Hammer,
  Sparkles, Rocket, TestTube2, Palette, Lightbulb
```

### 7.4 Icon usage pattern (Tailwind class)

```tsx
import { Plus } from "lucide-react";

<Plus className="h-4 w-4 stroke-2" aria-hidden="true" />
// always aria-hidden when paired with a label; aria-label when icon-only
```

---

## 8. Component Library

All components live under `components/ui/`. They are **Radix-primitives-based** (a11y for free), styled with Tailwind v4 utility classes, and composed via `cn()` (`clsx` + tailwind-merge). They follow a strict prop API: `variant`, `size`, `as`, and one root component per file.

### 8.1 Inventory

| Component | Base | Variants | Sizes | Notes |
|-----------|------|----------|-------|-------|
| **Button** | `<button>` | `primary` / `secondary` / `outline` / `ghost` / `danger` / `link` | `sm` / `md` / `lg` / `icon` | Loading spinner slot, `asChild` for Next Link |
| **IconButton** | `<button>` | `primary` / `secondary` / `ghost` / `danger` | `sm` / `md` / `lg` | Always `aria-label` required |
| **Input** | `<input>` | `default` / `error` / `success` | `sm` / `md` / `lg` | Addons (prefix/suffix icon), `type="search"` |
| **Textarea** | `<textarea>` | `default` / `error` | `sm` / `md` | Auto-grow via `react-textarea-autosize` |
| **Select** | Radix | `default` / `error` | `sm` / `md` | Searchable, multi-select variant |
| **Combobox** | Radix + cmdk | — | `md` | Used for user/project picker |
| **Checkbox** | Radix | — | `sm` / `md` | Indeterminate state built-in |
| **RadioGroup** | Radix | — | `md` | Card-style variant for WP type picker |
| **Switch** | Radix | — | `sm` / `md` | For notification settings |
| **Slider** | Radix | — | `sm` / `md` | Single + range |
| **Modal** | Radix Dialog | `default` / `danger` | `sm` / `md` / `lg` / `xl` / `full` | Nested modals supported (z + 1) |
| **Drawer** | Radix + vaul | `right` / `left` / `bottom` | `sm` / `md` / `lg` | Bottom sheet on mobile |
| **Popover** | Radix | — | `md` | Anchored to trigger |
| **Tooltip** | Radix | `default` / `rich` | `sm` / `md` | 300ms delay, 12px arrow |
| **Toast** | Radix + sonner-style | `success` / `error` / `warning` / `info` | `sm` / `md` | Stacked, auto-dismiss 5s, action button slot |
| **Tabs** | Radix | `default` / `pills` / `underline` | `md` | URL-driven with `nuqs` |
| **Accordion** | Radix | `default` / `bordered` | `md` | One or many open |
| **DropdownMenu** | Radix | — | `sm` / `md` | With separators, labels, checkboxes |
| **ContextMenu** | Radix | — | `md` | Right-click on WP rows |
| **Command** | cmdk | — | `md` | Cmd-K palette |
| **Table** | semantic HTML | `default` / `compact` / `bordered` | — | Head/body/row/cell subcomponents |
| **Card** | `<div>` | `default` / `bordered` / `elevated` | — | Header/Body/Footer slots |
| **Avatar** | `<div>` + Image | `default` | `xs` / `sm` / `md` / `lg` / `xl` | Initials fallback, status dot |
| **AvatarGroup** | — | — | `sm` / `md` | +N overflow |
| **Badge** | `<span>` | `default` / `success` / `warning` / `error` / `info` / `neutral` + outline | `sm` / `md` | Optional dot, optional close |
| **Progress** | Radix | linear / circular | `sm` / `md` / `lg` | Determinate + indeterminate |
| **Skeleton** | `<div>` | text / circle / block | — | Shimmer disabled by default (we use static block) |
| **Separator** | Radix | horizontal / vertical | — | |
| **Kbd** | `<kbd>` | — | `sm` / `md` | For shortcut display |
| **Breadcrumb** | nav + ol | `default` / `slash` | `md` | Truncates at >3 levels |
| **Pagination** | — | `default` / `simple` | `sm` / `md` | Cursor-based, with total count |
| **EmptyState** | `<div>` | `default` / `bordered` | — | Icon + title + description + 1-2 actions |
| **Alert** | `<div>` | `info` / `success` / `warning` / `error` | `sm` / `md` | Inline (in form) vs banner (page) |
| **Banner** | `<div>` | `info` / `success` / `warning` / `error` | `md` | Dismissible |
| **Avatar presence dot** | `<span>` | `online` / `away` / `busy` / `offline` | `sm` / `md` | |

### 8.2 Component recipes (the most important)

#### 8.2.1 Button

```tsx
// components/ui/Button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // base — applies to all variants
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md " +
    "text-sm font-medium ring-offset-background " +
    "transition-colors duration-fast ease-out " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "active:translate-y-px " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary-600 text-text-onPrimary hover:bg-primary-700 active:bg-primary-800",
        secondary:
          "bg-surface-raised text-text-default border border-border-default hover:bg-slate-50 active:bg-slate-100",
        outline:
          "border border-border-default bg-transparent text-text-default hover:bg-slate-50 active:bg-slate-100",
        ghost:
          "text-text-default hover:bg-slate-100 active:bg-slate-200",
        danger:
          "bg-error-600 text-white hover:bg-error-700 active:bg-error-800",
        link:
          "text-primary-700 underline-offset-4 hover:underline px-0 py-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? <Loader2 className="animate-spin" /> : leftIcon}
        {children}
        {rightIcon}
      </Comp>
    );
  }
);
Button.displayName = "Button";
```

**Usage:**

```tsx
<Button variant="primary" leftIcon={<Plus />}>New work package</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button asChild><Link href="/projects/new">Create</Link></Button>
<Button variant="danger" isLoading={deleting}>Delete</Button>
```

#### 8.2.2 Input

```tsx
const inputVariants = cva(
  "flex h-9 w-full rounded-md border bg-surface-raised px-3 py-1 text-sm " +
    "shadow-xs transition-colors duration-fast " +
    "placeholder:text-text-subtle " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 " +
    "disabled:cursor-not-allowed disabled:opacity-50 " +
    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
  {
    variants: {
      variant: {
        default: "border-border-default hover:border-border-strong",
        error: "border-error-500 focus-visible:ring-error-500/30",
        success: "border-success-500 focus-visible:ring-success-500/30",
      },
      size: {
        sm: "h-8 text-xs",
        md: "h-9 text-sm",
        lg: "h-10 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);
```

**Input with addons (search bar, currency):**

```tsx
<div className="relative">
  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
  <Input className="pl-8" placeholder="Search…" />
</div>
```

#### 8.2.3 Modal (Radix-based)

```tsx
const Modal = Dialog.Root;
const ModalTrigger = Dialog.Trigger;
const ModalClose = Dialog.Close;

const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, children, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg",
      xl: "max-w-xl", "2xl": "max-w-2xl", full: "max-w-[min(96vw,1400px)]",
    }[size];

    return (
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-modal bg-surface-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          ref={ref}
          className={cn(
            "fixed left-1/2 top-1/2 z-modal-content w-full -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border border-border-subtle bg-surface-raised shadow-lg",
            "p-6 duration-base data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            sizeClasses, className,
          )}
          {...props}
        >
          {children}
          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    );
  }
);
```

**Animation note:** We use `tailwindcss-animate` for enter/exit. Modal slides + fades; Drawer slides from side; Popover scales from 95%.

#### 8.2.4 Table

We do not use a table library. Semantic HTML + Tailwind:

```tsx
<div className="rounded-md border border-border-subtle overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full caption-bottom text-sm tabular-nums">
      <thead className="bg-slate-50 [&_tr]:border-b [&_tr]:border-border-subtle">
        <tr className="hover:bg-transparent">
          <th className="h-10 px-3 text-left align-middle font-medium text-text-muted">ID</th>
          <th className="h-10 px-3 text-left align-middle font-medium text-text-muted">Subject</th>
          <th className="h-10 px-3 text-left align-middle font-medium text-text-muted">Status</th>
          <th className="h-10 px-3 text-left align-middle font-medium text-text-muted">Assignee</th>
          <th className="h-10 px-3 text-left align-middle font-medium text-text-muted">Due</th>
        </tr>
      </thead>
      <tbody className="[&_tr:last-child]:border-0">
        {rows.map(row => (
          <tr key={row.id} className="border-b border-border-subtle transition-colors hover:bg-slate-50/60 focus-within:bg-slate-50">
            <td className="px-3 py-2 align-middle text-text-muted">#{row.id}</td>
            <td className="px-3 py-2 align-middle font-medium">{row.subject}</td>
            <td className="px-3 py-2 align-middle"><StatusBadge status={row.status} /></td>
            <td className="px-3 py-2 align-middle"><Avatar name={row.assignee} /></td>
            <td className="px-3 py-2 align-middle text-text-muted">{formatDate(row.due)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

**Row height:** `py-2` = 32px content + 1px border = 33px. This is the target — not 48px (Too airy for PM tables).

#### 8.2.5 Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Recent activity</CardTitle>
    <CardDescription>Latest changes across your projects</CardDescription>
  </CardHeader>
  <CardContent>…</CardContent>
  <CardFooter>
    <Button variant="link" size="sm">View all</Button>
  </CardFooter>
</Card>
```

**Card anatomy:**

```
┌─ CardHeader (px-6 py-4 border-b) ──────┐
│ Title                                  │
│ Description (optional, text-muted)     │
├─ CardContent (px-6 py-4) ─────────────┤
│ ...                                    │
├─ CardFooter (px-6 py-4 border-t) ─────┤
│ Actions right-aligned                  │
└────────────────────────────────────────┘
```

#### 8.2.6 Toast (using `sonner`-style)

We use a custom hook over Radix Toast; 1-line usage:

```tsx
import { toast } from "@/components/ui/Toast";

toast.success("Work package created");
toast.error("Failed to save", { description: "Network error" });
toast.warning("Heads up", { action: { label: "Undo", onClick: undo } });
```

**Anatomy:** Bottom-right on desktop, top-center on mobile, max 3 visible, 5s default, hover pauses, action button right-aligned.

#### 8.2.7 Sidebar (project-scoped)

```tsx
<aside
  className={cn(
    "sticky top-16 hidden h-[calc(100vh-4rem)] flex-col border-r border-border-subtle bg-surface-sidebar transition-[width] duration-base md:flex",
    collapsed ? "w-16" : "w-60"
  )}
  aria-label="Project navigation"
>
  {/* Project header — click to expand/collapse */}
  <div className="flex h-14 items-center gap-2 border-b border-border-subtle px-3">
    <div className="grid size-8 place-items-center rounded-md bg-primary-100 text-primary-700 font-semibold text-sm">
      {project.shortName}
    </div>
    {!collapsed && (
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{project.name}</p>
        <p className="truncate text-xs text-text-muted">{project.identifier}</p>
      </div>
    )}
  </div>

  {/* Module nav (modules enabled in this project) */}
  <nav className="flex-1 overflow-y-auto p-2">
    <ul className="space-y-0.5">
      {items.map(item => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm",
              "hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none",
              active && "bg-primary-50 text-primary-700 font-medium hover:bg-primary-100"
            )}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        </li>
      ))}
    </ul>
  </nav>

  <button
    onClick={toggleSidebar}
    className="m-2 flex items-center justify-center rounded-md p-1.5 text-text-muted hover:bg-slate-100"
    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
  >
    {collapsed ? <PanelLeft /> : <PanelLeftClose />}
  </button>
</aside>
```

#### 8.2.8 Topbar (global)

```tsx
<header className="sticky top-0 z-sticky h-16 border-b border-border-subtle bg-surface-topbar/80 backdrop-blur supports-[backdrop-filter]:bg-surface-topbar/60">
  <div className="flex h-full items-center gap-4 px-4 sm:px-6">
    {/* Logo (hidden on lg+ when sidebar shows logo) */}
    <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
      <LogoMark className="size-7" />
    </Link>

    {/* Global search (cmd-K) */}
    <button
      onClick={openCommandPalette}
      className="flex h-9 flex-1 max-w-md items-center gap-2 rounded-md border border-border-default bg-slate-50 px-3 text-sm text-text-subtle hover:bg-slate-100"
    >
      <Search className="size-4" aria-hidden="true" />
      <span className="flex-1 text-left">Search anything…</span>
      <Kbd>⌘K</Kbd>
    </button>

    <div className="ml-auto flex items-center gap-1">
      <QuickCreateMenu />
      <NotificationBell />
      <HelpMenu />
      <UserMenu />
    </div>
  </div>
</header>
```

#### 8.2.9 Breadcrumb

```tsx
<nav aria-label="Breadcrumb" className="text-sm">
  <ol className="flex items-center gap-1.5 text-text-muted">
    <li><Link href="/projects" className="hover:text-text-default">Projects</Link></li>
    <ChevronRight className="size-3.5 opacity-50" />
    <li><Link href={`/projects/${id}`} className="hover:text-text-default">{name}</Link></li>
    <ChevronRight className="size-3.5 opacity-50" />
    <li><Link href={`/projects/${id}/work-packages`} className="hover:text-text-default">Work packages</Link></li>
    <ChevronRight className="size-3.5 opacity-50" />
    <li aria-current="page" className="font-medium text-text-default truncate max-w-[20ch]">#{wpId} {subject}</li>
  </ol>
</nav>
```

#### 8.2.10 Badge

```tsx
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-slate-100 text-slate-700 border-transparent",
        success: "bg-success-100 text-success-700 border-transparent",
        warning: "bg-warning-100 text-warning-700 border-transparent",
        error:   "bg-error-100   text-error-700   border-transparent",
        info:    "bg-info-100    text-info-700    border-transparent",
        primary: "bg-primary-100 text-primary-700 border-transparent",
      },
      variant: {
        solid: "", outline: "bg-transparent border-current",
      },
    },
    defaultVariants: { tone: "neutral", variant: "solid" },
  }
);
```

#### 8.2.11 Avatar

```tsx
<Avatar className="size-8">
  <AvatarImage src={user.avatarUrl} alt="" />
  <AvatarFallback className="bg-primary-100 text-primary-700 text-xs font-semibold">
    {initials(user.name)}
  </AvatarFallback>
</Avatar>
```

#### 8.2.12 Tabs

```tsx
<Tabs defaultValue="overview" value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="activity">Activity</TabsTrigger>
    <TabsTrigger value="work-packages">Work packages <Badge tone="neutral" className="ml-1.5">128</Badge></TabsTrigger>
    <TabsTrigger value="members">Members</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="overview" className="mt-6">…</TabsContent>
  …
</Tabs>
```

**Tab variants:**
- `default` — underline below text (active: border-b-2 border-primary-600)
- `pills` — rounded-md, active: bg-primary-50 text-primary-700
- `boxed` — bordered, active: bg-white -mb-px

#### 8.2.13 DropdownMenu

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="More actions">
      <MoreHorizontal className="size-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuLabel>Work package</DropdownMenuLabel>
    <DropdownMenuItem><Pencil className="mr-2 size-4" /> Edit</DropdownMenuItem>
    <DropdownMenuItem><Copy className="mr-2 size-4" /> Duplicate</DropdownMenuItem>
    <DropdownMenuItem><Link2 className="mr-2 size-4" /> Copy link</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem><Move className="mr-2 size-4" /> Move to project…</DropdownMenuItem>
    <DropdownMenuItem><Archive className="mr-2 size-4" /> Archive</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive"><Trash2 className="mr-2 size-4" /> Delete…</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

#### 8.2.14 Progress (linear + circular)

```tsx
<Progress value={73} tone="primary" />         // linear, 8px tall
<Progress value={73} tone="success" size="md" />
<CircularProgress value={73} size={64} strokeWidth={6} />  // for sprint burndown
```

**Tones:** `primary` (Indigo), `success` (Green), `warning` (Amber), `error` (Red). No tone = slate.

#### 8.2.15 Tooltip

```tsx
<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Add attachment">
        <Paperclip className="size-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom">
      <p>Add attachment</p>
      <p className="text-xs text-text-subtle">Max 50 MB</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### 8.2.16 Drawer

For mobile: a `vaul`-based bottom sheet.
For desktop: a right-side panel for WP quick-view.

```tsx
<Drawer open={open} onOpenChange={setOpen} direction={isMobile ? "bottom" : "right"}>
  <DrawerContent className={isMobile ? "rounded-t-xl" : "h-full max-w-md ml-auto"}>
    <DrawerHeader>
      <DrawerTitle>Quick view</DrawerTitle>
    </DrawerHeader>
    <div className="flex-1 overflow-y-auto p-4">{children}</div>
  </DrawerContent>
</Drawer>
```

#### 8.2.17 Combobox (searchable select, used for user/assignee picker)

```tsx
<Combobox
  value={assigneeId}
  onChange={setAssigneeId}
  options={users.map(u => ({ value: u.id, label: u.name, secondary: u.email, icon: <Avatar ... /> }))}
  placeholder="Assign to…"
  emptyMessage="No matching user"
  renderOption={({ option }) => (
    <div className="flex items-center gap-2">
      <Avatar name={option.label} size="sm" />
      <div>
        <p className="text-sm">{option.label}</p>
        <p className="text-xs text-text-muted">{option.secondary}</p>
      </div>
    </div>
  )}
/>
```

#### 8.2.18 StatusBadge (work-package-specific)

```tsx
<StatusBadge status={wp.status} /> // "new" | "in-progress" | "in-review" | "done" | "closed" | "on-hold" | "rejected"
```

Renders a colored dot + label, automatically pulling from the `--color-status-*` tokens.

#### 8.2.19 EmptyState (used everywhere)

```tsx
<EmptyState
  icon={<Inbox className="size-12 text-text-subtle" />}
  title="No work packages yet"
  description="Create your first work package to start tracking work in this project."
  primaryAction={<Button leftIcon={<Plus />}>New work package</Button>}
  secondaryAction={<Button variant="link">Import from CSV</Button>}
  learnMoreLink="/help/work-packages"
/>
```

**Layout:** Icon at top (centered, muted), title, description (1-2 lines max), primary action, secondary action, learn-more link. Card-shaped, not full-bleed. We deliberately do **not** add large illustrations.

### 8.3 Composition rule

**Components are leaves.** A Card has no concept of "table" or "form" — it is a container. A Page assembles components. There is no "UserCard" compound; instead, a generic `Card` + a small "UserHeader" composition.

---

## 9. Motion & Microinteractions

### 9.1 Motion tokens

| Token | Value | Use |
|-------|-------|-----|
| `--duration-instant` | 0ms | Disabled state, error flash |
| `--duration-fast` | 120ms | Hover, focus, button press, color transitions |
| `--duration-base` | 200ms | Most UI transitions, dropdown open |
| `--duration-slow` | 300ms | Modal/drawer enter, page transitions |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 90% of transitions (ease-out-expo) |
| `--ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exit only |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Bidirectional (toggle) |

### 9.2 Honor user preference

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 9.3 Specific microinteractions

| Surface | Trigger | Effect |
|---------|---------|--------|
| **Button (primary)** | hover | bg → 700 in 120ms, no transform |
| **Button (primary)** | active | translate-y(1px), bg → 800 in 60ms |
| **Button (icon-only)** | hover | bg-slate-100 fade in 120ms |
| **Row (table)** | hover | bg-slate-50 fade in 120ms (stays on focus-within) |
| **Row (table)** | selected | bg-primary-50, 2px left-border-primary-600 |
| **Link** | hover | color → primary-700, underline fade in 80ms |
| **Card (clickable)** | hover | shadow-sm → shadow-md, border → default, in 200ms |
| **Switch** | toggle | thumb slides 200ms, color primary-600→primary-700 |
| **Tab** | hover (inactive) | underline grow to 50% width in 150ms |
| **Tab** | active | underline full width, color primary-600 |
| **Checkbox** | check | scale 0.8 → 1.0 with bounce (cubic-bezier(0.34, 1.56, 0.64, 1)) |
| **Toast** | enter | slide from right 24px + fade, 200ms |
| **Toast** | exit | slide right 24px + fade, 200ms |
| **Modal scrim** | enter | fade in 200ms |
| **Modal content** | enter | scale 0.95 → 1.0 + fade, 200ms ease-out |
| **Drawer (right)** | enter | translateX(100% → 0), 300ms ease-out |
| **Drawer (bottom)** | enter | translateY(100% → 0), 300ms ease-out, with backdrop fade |
| **Skeleton block** | — | **No shimmer.** Static block with bg-slate-200, optionally pulsing very slow (3s) — and only if expected duration > 2s |
| **Spinner** | loading | rotate 360° 1s linear infinite, 4px stroke, currentColor |
| **Dropdown** | open | scale 0.95 → 1.0 + fade, 120ms |
| **Popover** | open | same as dropdown |
| **Tooltip** | open | fade + translateY(2px), 120ms, 300ms delay |
| **Notification badge** | new | ping animation 1.5s once, then stop |
| **WP card (board)** | drag start | scale 1.02, shadow-lg, rotation 1.5° |
| **WP card (board)** | drop | snap back, flash primary-100 for 200ms |
| **Gantt bar** | hover | outline 2px primary-500 fade in 100ms |
| **Gantt bar** | drag edge | cursor ew-resize, bar outline scales 1.02 |
| **Page transition** | route change | fade out 100ms → fade in 150ms (template-only) |
| **Status change (badge)** | value change | pulse: scale 1 → 1.05 → 1, 200ms, with tone change crossfade |
| **Checkbox row select** | select | row bg primary-50, left-border 2px primary-600, 150ms |
| **Inline edit save** | success | subtle primary-500 ring pulse 400ms, then fade |
| **Inline edit error** | failure | ring error-500 pulse 600ms, shake 4px, 300ms |
| **Empty state enter** | mount | fade in 300ms, no translate (we hate dramatic motion) |

### 9.4 Page transitions

Using Next.js Pages Router, we use a lightweight `AnimatePresence`-like wrapper around the page content, but only for top-level routes (not within sub-tabs). We avoid full-page transitions because they feel slow.

```tsx
// pages/_app.tsx
import { motion, AnimatePresence } from "framer-motion";

export default function App({ Component, pageProps, router }) {
  return (
    <QueryClientProvider>
      <SessionProvider>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={router.asPath}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>
      </SessionProvider>
    </QueryClientProvider>
  );
}
```

### 9.5 Forbidden animations

- Bouncy spring on critical-path UI (modals, dropdowns, toasts) — feels toy-like
- Long animations (> 400ms) on common actions — feels slow
- Parallax, scroll-jacking, 3D transforms in the main app
- Confetti or emoji bursts on success (this is a work tool, not a game)
- Auto-playing animated illustrations in empty states

---

## 10. Accessibility (WCAG 2.1 AA)

### 10.1 Conformance target

We target **WCAG 2.1 Level AA** as a floor, with selected AAA criteria (contrast 7:1 for body text where feasible, focus visible always). The full AA checklist is in `docs/a11y-checklist.md` (to be created by a11y team); below are the binding rules every component must follow.

### 10.2 Color & contrast

- **Text < 18px regular / < 14px bold**: 4.5:1 minimum
- **Text ≥ 18px regular / ≥ 14px bold**: 3:1 minimum
- **UI components & graphics**: 3:1 minimum
- **Focus indicator**: 3:1 against adjacent colors

We use a CI step that runs `axe-core` on every PR with violations failing the build.

### 10.3 Focus management

```css
/* default — applied to all interactive elements via :focus-visible */
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
  border-radius: inherit;
}
/* remove default for non-keyboard users */
:focus:not(:focus-visible) { outline: none; }
```

**Never** `outline: none` without a replacement ring.

**Focus order** must match visual order. Skip-links are provided:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-tooltip focus:rounded-md focus:bg-primary-600 focus:px-3 focus:py-2 focus:text-white">
  Skip to main content
</a>
```

### 10.4 Keyboard support matrix

| Action | Shortcut |
|--------|----------|
| Focus search | `/` |
| Command palette | `⌘ K` / `Ctrl K` |
| New work package | `c` (in project) |
| New project | `g p` then `n` |
| Go to projects | `g p` |
| Go to dashboard | `g d` |
| Go to my page | `g m` |
| Show shortcuts | `?` |
| Close modal/drawer/popover | `Esc` |
| Move between cells (table) | `Tab` / `Shift+Tab` |
| Open row (table) | `Enter` |
| Multi-select (table) | `Space` (toggle), `Shift+↑/↓` (range) |
| Bulk actions | `x` then action key (e.g., `x d` to delete) |
| Next/prev tab (in tab list) | `←` / `→` |
| Activate tab | `Enter` / `Space` |
| Toggle sidebar | `[` |
| Toggle theme | `Shift+D` (in account menu) |
| Submit form | `Cmd/Ctrl+Enter` |
| Cancel form | `Esc` |

All keyboard shortcuts are also clickable (not gestures-only).

### 10.5 ARIA roles

| Component | Role | Notes |
|-----------|------|-------|
| Sidebar | `navigation` with `aria-label="Primary"` | |
| Topbar | `banner` (implicit on `<header>`) | |
| Breadcrumb | `nav aria-label="Breadcrumb"` containing `<ol>` | |
| Tabs | `tablist` / `tab` / `tabpanel` | Radix handles this |
| Modal | `dialog` + `aria-modal="true"` + `aria-labelledby` | Radix handles this |
| Drawer | `dialog` or `region` | We use `region` for non-modal |
| Toast | `status` (info) or `alert` (error) | Radix handles this |
| Table | `table` with `<caption>` if titled | |
| Status badge | `span` with `aria-label="Status: In progress"` if dot-only | |
| Notification badge count | `aria-label="3 unread notifications"` | |
| Avatar | `img` with `alt=""` if purely decorative, else name | |
| Toggle | `switch` + `aria-checked` | Radix |
| Menu | `menu` / `menuitem` | Radix |
| Loading region | `aria-live="polite"` for status, `aria-busy="true"` on region | |
| Form errors | `aria-invalid="true"` + `aria-describedby` pointing to error message | |

### 10.6 Screen reader support

- **Live regions**: Notification toast region is `aria-live="polite"`, error toasts `aria-live="assertive"`. Page title changes announce on route change via Next's title.
- **Hidden content**: `.sr-only` for skip-links and icon-only labels. `aria-hidden="true"` on decorative icons (we have a `<Icon>` wrapper that does this by default).
- **Status updates**: When a WP is saved via inline edit, we render a "Saved" toast and update the page title's `aria-live` region. When a filter is applied, we announce "Showing 23 of 142 work packages".
- **Tables**: `<th scope="col">`, sortable headers have `aria-sort="ascending|descending|none"`, row count announced via `aria-rowcount` for virtualized lists.
- **Drag-and-drop**: Kanban board cards are draggable; we provide keyboard alternative — focus a card, press `Space` to "pick up", `←/→` to move, `Space` to drop. Announce column changes.

### 10.7 Forms

- Every `<input>` has a `<label>` (or `aria-label` / `aria-labelledby`).
- Required fields: `aria-required="true"` + visual asterisk.
- Error messages: `aria-invalid="true"`, error text linked via `aria-describedby`.
- Group errors in a top-of-form `<Alert variant="error">` summarizing how many errors; individual errors also shown inline.
- Fieldsets with `<legend>` for radio/checkbox groups.

### 10.8 Motion & vestibular

- `prefers-reduced-motion: reduce` removes all non-essential motion (§9.2).
- No auto-playing animations.
- No flashing content > 3 Hz (a11y guideline, not just AAA).

### 10.9 Touch targets

- Minimum 44×44 CSS pixels for all interactive elements (WCAG 2.5.5 AAA, we adopt as floor).
- Icon buttons `size="icon"` are 36×36 visual but padded to 44×44 hit area via `before:` pseudo-element on touch devices.

### 10.10 Language & RTL

- `<html lang="en">` (or matching content language) declared in `_document.tsx`.
- All copy uses logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) for future RTL.
- Tailwind logical utilities: `ms-2` not `ml-2`, `pe-3` not `pr-3`.
- Icons that have direction (arrows) flip in RTL via `rtl:rotate-180`.

---

## 11. Page-by-Page Wireframes

This section describes every page in the current 52-page surface. Each entry: purpose, layout sketch (ASCII), key components, and special considerations.

### 11.1 Index & Auth (3 pages)

#### 11.1.1 `/` (Landing / index.tsx)

**Purpose:** Marketing entry, also handles logged-in redirect to `/dashboard`.

**Layout:**
- Public: hero with login CTA, feature grid (3 columns), testimonial, footer
- Authenticated: `useEffect` redirects to `/dashboard`

```
┌─────────────────────────────────────────────────────┐
│ [Logo] OpenProject          [Docs] [Pricing] [Login]│
├─────────────────────────────────────────────────────┤
│                                                     │
│     Team projects, beautifully organized.           │
│     Sub-headline                                    │
│     [Start free] [Watch demo]                       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Gantt]  [Boards]  [Wiki]  [Time]  [Reports]       │
│   icon     icon     icon    icon     icon           │
│   text     text     text    text     text           │
├─────────────────────────────────────────────────────┤
│  Testimonial carousel                               │
├─────────────────────────────────────────────────────┤
│  Footer: legal, social, sitemap                     │
└─────────────────────────────────────────────────────┘
```

**Key components:** `Button`, `Icon`, `Link`
**Special:** Auto-detect `?next=…` query param; if user is logged in, redirect there.

#### 11.1.2 `/login` (login.tsx)

**Purpose:** Credentials login + SSO options.

**Layout (split-screen on lg+, single column on mobile):**

```
┌──────────────────────┬──────────────────────────────┐
│ [gradient bg indigo] │ [white]                       │
│                      │                              │
│   [Logo]             │  Sign in to your account     │
│   OpenProject        │                              │
│                      │  ┌────────────────────────┐ │
│   Subhead            │  │ Email                  │ │
│                      │  └────────────────────────┘ │
│   • Tasks & Bugs     │  ┌────────────────────────┐ │
│   • Gantt Charts     │  │ Password         👁    │ │
│   • Team Boards      │  └────────────────────────┘ │
│   • Calendars        │  [x] Remember me   Forgot?   │
│                      │                              │
│                      │  [    Sign in    ]            │
│                      │  ── or continue with ──      │
│                      │  [Google] [GitHub] [LDAP]    │
│                      │                              │
│                      │  Don't have an account?      │
│                      │  Sign up                     │
└──────────────────────┴──────────────────────────────┘
```

**Key components:** `Button`, `Input`, `Label`, `Alert`, OAuth buttons.
**Special:** 2FA prompt follows on success if enabled; LDAP discovery on first SSO attempt.

#### 11.1.3 Register (not in current code — see §18)

Recommended page: `/register` with same split layout, "Create account" form.

### 11.2 Dashboard (2 pages)

#### 11.2.1 `/dashboard` (dashboard.tsx)

**Purpose:** Logged-in user's home — recent projects, assigned WPs, news, time.

**Layout:**

```
┌─ Topbar ───────────────────────────────────────────────────────────┐
├─ Sidebar (no project) ─┬─ Page header ───────────────────────────┐
│                        │  Good morning, Alex                       │
│  • Dashboard (active)  │  Here's what's happening today.           │
│  • Projects            │                                          │
│  • My page             │  ┌─ Project status ───────────────────┐ │
│  • Notifications  [3]  │  │ 6 active projects                   │ │
│  • Calendar            │  │ [grid of project cards: status pill]│ │
│  • Time tracking       │  └─────────────────────────────────────┘ │
│                        │                                          │
│                        │  ┌─ Assigned to you ─┬─ Time this week ─┐│
│                        │  │ [WP row]           │ [10h 23m logged]  ││
│                        │  │ [WP row]           │ [progress bar]   ││
│                        │  │ [WP row]           │                  ││
│                        │  │ View all →         │                  ││
│                        │  └────────────────────┴──────────────────┘│
│                        │                                          │
│                        │  ┌─ Recent activity ─────────────────────┐│
│                        │  │ Jane closed WP #452                   ││
│                        │  │ Bob updated timeline                  ││
│                        │  └──────────────────────────────────────┘│
│                        │                                          │
│                        │  ┌─ Upcoming meetings ─┬─ News ────────┐ │
│                        │  │ • Sprint planning 3pm │ Project X    │ │
│                        │  │ • 1:1 Alex→Bob 4pm   │ released!    │ │
│                        │  └──────────────────────┴───────────────┘ │
└────────────────────────┴──────────────────────────────────────────┘
```

**Key components:** `Card`, `ProjectStatusWidget`, `AssignedWorkPackagesWidget`, `TimeEntriesWidget`, `ActivityFeed`, `UpcomingMeetingsWidget`.
**Special:** Widget order persisted per-user (drag to reorder). Empty state with "Create your first project".

#### 11.2.2 `/dashboard/global` (dashboard/global.tsx)

**Purpose:** Admin-only global view — all projects, all WPs at risk, system health.

**Layout:** 4-column widget grid:
1. System health (Sentry errors, queue depth, DB latency)
2. Active users (24h, 7d)
3. WP status breakdown (donut chart)
4. New signups (line chart, 30d)

**Key components:** Same as personal dashboard + admin charts.
**Special:** `requireAdmin` server-side guard.

### 11.3 Projects (2 pages + 14 nested)

#### 11.3.1 `/projects` (projects/index.tsx)

**Purpose:** Project list with hierarchy.

**Layout:**

```
┌─ Topbar ──────────────────────────────────────────────────────┐
│ Page header: Projects           [Filter] [Sort] [+ New]      │
│ Tabs: All | Favorites | Archived                              │
│                                                                │
│ ┌─ Tree view ──────────────────────────────────────────────┐ │
│ │ ▾ Acme Corp  2 projects                                    │ │
│ │   ▾ Mobile App     🟢 On track     42 WPs  8 members       │ │
│ │     • iOS  🔴 Off track     18 WPs                         │ │
│ │     • Android  🟢 On track   24 WPs                        │ │
│ │   ▸ Web Platform  🟡 At risk                                 │ │
│ │ ▾ Internal Tools  1 project                                 │ │
│ │   ▸ Design System  🟢 On track                              │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ 12 projects, 8 active                                          │
└────────────────────────────────────────────────────────────────┘
```

**Key components:** `ProjectCard`, tree expand/collapse, status pill, member avatars.
**Special:** `favorites` filter uses star icon; `archived` tab uses different card variant (faded).

#### 11.3.2 `/projects/new` (projects/new.tsx)

**Purpose:** Create a new project (wizard or single page).

**Layout (single-page form):**

```
┌─ Page header: New project ─────────────────────────────────┐
│                                                              │
│ ┌─ Step 1: Basics ──┬─ Step 2: Modules ─┬─ Step 3: Members ┐│
│ │ Name *            │ ☑ Work packages   │ + Add members     ││
│ │ Identifier *      │ ☑ Gantt           │                  ││
│ │ Parent project    │ ☑ Board           │                  ││
│ │ Description       │ ☐ Wiki            │                  ││
│ │ Public | Private  │ ☐ Calendar        │                  ││
│ │ Status            │ ☐ Budgets         │                  ││
│ │ Color             │ …                 │                  ││
│ └───────────────────┴───────────────────┴──────────────────┘│
│                                                              │
│                                          [Cancel] [Create]  │
└──────────────────────────────────────────────────────────────┘
```

**Key components:** `Input`, `Select`, `Textarea`, `RadioGroup`, `Checkbox`, `Button`.
**Special:** Step 1 → 2 → 3 use Tabs. We considered multi-step wizard but decided single-page with sections reduces friction.

#### 11.3.3 `/projects/[projectId]` (project detail)

This is the **most-visited** page in the app. Layout:

```
┌─ Topbar ─────────────────────────────────────────────────────┐
├─ Project sidebar ──┬─ Project header ───────────────────────┐
│  [Project card]    │  ★ Mobile App iOS  🟢 On track          │
│  ── Navigation ──  │  identifier: mobile-ios                 │
│  Overview          │  [Edit] [Share] [More ▼]                │
│  Activity          │                                          │
│  Work packages 128 │  ┌─ Tabs ──────────────────────────────┐│
│  Gantt             │  │ Overview │ Activity │ WPs │ Members  ││
│  Board             │  │          │          │     │ Settings  ││
│  Calendar          │  └──────────────────────────────────────┘│
│  Wiki              │                                          │
│  News              │  ┌─ Description ─┬─ Status sidebar ───┐│
│  Forums            │  │  [markdown]    │ Status: 🟢 On track││
│  Documents         │  │                │ Start: 2026-01-12  ││
│  Members    8      │  │                │ End:   2026-08-30  ││
│  Budgets     2     │  │                │ % complete: 62%   ││
│  Time tracking     │  │                │ [progress bar]    ││
│  Backlogs          │  └────────────────┴────────────────────┘│
│  Meetings    3     │                                          │
│  Repository        │  ┌─ Recent activity ───────────────────┐│
│  Reports           │  │ • Jane created WP #452  2h ago      ││
│  Settings          │  │ • Bob logged 4h on #381  4h ago     ││
│                    │  │ • Alex commented on wiki 1d ago     ││
│                    │  └─────────────────────────────────────┘│
└────────────────────┴──────────────────────────────────────────┘
```

**Key components:** `Tabs`, `Card`, `Progress`, `ActivityFeed`, `AvatarGroup`, `StatusBadge`, `Markdown`.
**Special:** Module visibility determined by project-level `enabledModules`; disabled modules hidden from sidebar. Star button toggles favorite.

#### 11.3.4 `/projects/[projectId]/activity` (activity/index.tsx)

**Purpose:** Filtered project activity feed.

```
┌─ Page header: Activity ─────────────────────────────────────┐
│ Filters: [Type ▼] [Author ▼] [Date range] [Reset]           │
│                                                                │
│ ┌─ Day: 2026-06-05 ──────────────────────────────────────┐ │
│ │ Jane created WP #452 "Add OAuth flow"                    │ │
│ │ Bob updated status of #381 to "In review"               │ │
│ │ ...                                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ Day: 2026-06-04 ──────────────────────────────────────┐ │
│ │ ...                                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                                │
│ [Load more]                                                    │
└────────────────────────────────────────────────────────────────┘
```

#### 11.3.5 `/projects/[projectId]/work-packages` (work-packages/index.tsx)

**Purpose:** The flagship page. Table view by default, switchable to Board/Gantt/Calendar.

**Layout (Table view):**

```
┌─ Toolbar ─────────────────────────────────────────────────────┐
│ Work packages  [Saved view ▼] [All] [Mine] [Recent]            │
│ [Filter +]  [Group by: Status ▼]  [Sort: Manual ▼]  [Columns] │
│                                                                │
│ ☐  ID  ▼  Subject            Type  Status    Assignee  Due   ⋯│
│ ──────────────────────────────────────────────────────────────│
│ ☐  #452 Add OAuth flow     Task  🆕 New     [JA]    -      ⋯│
│ ☐  #451 Fix login redirect Bug   ✅ Done    [BB]    06/01 ⋯│
│ ☑  #450 Refactor Gantt     Task  🔄 Review  [AA]    06/08 ⋯│
│ ☐  #449 Add 2FA setup      Task  ⏸ On hold [DD]    06/15 ⋯│
│ ☐  #448 Update wiki        Task  🆕 New     [CC]    -      ⋯│
│                                                                │
│ 128 work packages  |  5 of 128 selected   [< 1/26 >]          │
└────────────────────────────────────────────────────────────────┘
```

**Key components:** `WorkPackageTable`, `WorkPackageFilters`, `QuerySwitcher`, `WorkPackageBulkActions`, `WorkPackageInlineEdit`, virtualized list.
**Special:**
- Row height 32px content + 1px border
- Sticky header
- Inline editing: click cell → becomes `Input` / `Select` / etc → blur or `Enter` saves, `Esc` cancels
- Optimistic update with rollback on error
- Virtualized (TanStack Virtual) — must handle 10k+ rows smoothly
- `Manual` sort enables drag-handle on left edge

**Layout (Board view)** — see 11.3.7

**Layout (Gantt view)** — see 11.3.8

**Layout (Calendar view)** — see 11.3.9

#### 11.3.6 `/projects/[projectId]/work-packages/[id]` (work-packages/[id].tsx)

**Purpose:** Work package detail page.

```
┌─ Breadcrumb: Projects / Mobile App / WPs / #452 ───────────────┐
│ ┌─ Left column (main) ─────────────┬─ Right sidebar (320px) ─┐│
│ │ ☐ Task  #452                       │ [Mark complete] [Edit] ││
│ │ # Add OAuth flow                   │ ─────────────────────  ││
│ │ ── Description (inline edit) ──── │ Type:        Task      ││
│ │ [markdown body]                    │ Status:      🆕 New    ││
│ │                                    │ Priority:    Normal    ││
│ │ ── Activity ────────────────────── │ Assignee:   [JA] Jane ││
│ │ • Alex commented 2h ago            │ Watchers:   +2         ││
│ │   "Looks good…"                    │ Start:      2026-06-01 ││
│ │ • Jane created 3h ago              │ Due:        2026-06-12 ││
│ │                                   │ % Complete:  [60]%     ││
│ │ [Reply...]                         │ Estimated:  8h         ││
│ │                                   │ Spent:      4h 30m    ││
│ │                                   │ Project:    Mobile App ││
│ │ ── Relations ──────────────────── │ Author:     [JA] Jane  ││
│ │ Related to #378 (follows)         │ Created:    2 days ago ││
│ │ + Add relation                     │ Category:   User auth  ││
│ │                                   │ Version:    v2.4.0     ││
│ │ ── Files (2) ──────────────────── │ Custom:     [edit]    ││
│ │ 📄 oauth-flow.png  📄 spec.pdf    │                         ││
│ │                                   │ [Watch] [Share] [⋯]    ││
│ │ ── Time entries (3) ──────────── │                          ││
│ │ Bob  4h  2026-06-05  Comment      │                          ││
│ │ [Log time]                        │                          ││
│ └───────────────────────────────────┴──────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

**Key components:** `AttributeSidebar`, `DescriptionEditor`, `ActivityFeed`, `RelationsList`, `WatchButton`, `CustomFieldInput`.
**Special:**
- Every attribute is inline-editable on click
- Activity tab is default; full-page mode available
- `?show=relations` deep-links to a section
- Custom fields rendered based on WP type config
- Two-column layout collapses to single column < lg

#### 11.3.7 `/projects/[projectId]/board` (board/index.tsx)

**Purpose:** Kanban board of work packages grouped by configurable attribute (default: status).

```
┌─ Toolbar: Board   [Group by: Status ▼] [WIP limits] [+ Add WP] ─┐
│                                                                   │
│ ┌─ New (8) ──┬─ In prog (5) ─┬─ Review (3) ─┬─ Done (47) ─┐       │
│ │            │  WIP: 8/10    │  WIP: 3/3   │             │       │
│ │  ┌─ #452 ─┐│              │ ⚠ WIP LIMIT │  ┌─ #451 ─┐ │       │
│ │  │OAuth…  ││  ┌─ #450 ─┐  │              │  │Login…  │ │       │
│ │  │👤JA    ││  │Refactor│  │  ┌─ #447 ─┐  │  │👤BB    │ │       │
│ │  │📅06-12││  │👤AA   │  │  │Audit…  │  │  │📅06-01│ │       │
│ │  └────────┘│  │📅06-08│  │  │👤CC    │  │  └────────┘ │       │
│ │  ┌─ #449 ─┐│  └────────┘  │  │📅06-09│  │             │       │
│ │  │2FA…    ││              │  └────────┘  │             │       │
│ │  │👤DD   ││              │              │             │       │
│ │  └────────┘│              │              │             │       │
│ │   + Add    │   + Add      │   + Add      │  + Add     │       │
│ └────────────┴──────────────┴──────────────┴─────────────┘       │
└───────────────────────────────────────────────────────────────────┘
```

**Key components:** `WorkPackageBoard`, `WorkPackageBoardColumn`, `WorkPackageBoardCard`, `WipLimitDialog`, dnd-kit.
**Special:**
- Drag cards between columns triggers status update
- WIP limit exceeded → red ring + ⚠ icon
- Card click → drawer opens with WP detail (vs navigating to full page)
- Keyboard: focus card, `Space` to pick up, `←/→` between columns, `Space` to drop

#### 11.3.8 `/projects/[projectId]/gantt` (gantt/index.tsx)

**Purpose:** Timeline / Gantt chart of WPs with dependencies.

```
┌─ Toolbar: Gantt  [Zoom: Day ▼] [Group: WP list ▼] [+ Add WP] ───┐
│                                                                   │
│ #    Subject          │ Jun 1   Jun 8   Jun 15  Jun 22  Jun 29   │
│ ──────────────────────┼─────────────────────────────────────────── │
│ 452  OAuth flow       │       ████████████                          │
│                       │       ↑         ↓                          │
│ 451  Login redirect   │  ████─┘                                    │
│                       │  (line: follows)                           │
│ 450  Refactor Gantt   │  ████████████████████                      │
│ 449  Add 2FA          │             ████─┐                         │
│ 448  Update wiki      │  ████─────────┘  (follows)                │
│                       │                                            │
│                  Today│              │                              │
│ ──────────────────────┴───────────────────────────────────────────│
│ 6 of 142 WPs visible    [Expand all] [Collapse all]               │
└───────────────────────────────────────────────────────────────────┘
```

**Key components:** `GanttChart`, `GanttBar`, `GanttDependencyLines`, `GanttTodayLine`, `GanttZoomControls`, virtualized rows.
**Special:**
- Pan horizontally, scroll vertically; sticky leftmost column
- Drag bar to shift dates; drag right edge to resize duration
- Hover bar → tooltip with full details; click → WP drawer
- Dependencies drawn as bezier curves with arrowheads
- Today line is 2px primary-500 with date label

#### 11.3.9 `/projects/[projectId]/calendar` (calendar/index.tsx)

**Purpose:** Month / week / day calendar of WP start/due dates.

```
┌─ Toolbar: Calendar  [< June 2026 >]  [Month ▼]  [+ Add WP] ─────┐
│                                                                   │
│ Mon  Tue  Wed  Thu  Fri  Sat  Sun                                │
│ ─────────────────────────────────────                            │
│  1    2    3    4    5    6    7                                 │
│           ●452  ●455                                            │
│  8    9   10   11   12   13   14                                │
│ ●448  ●450 ●451         ●449                                    │
│                                                                   │
│ 15   16   17   18   19   20   21                                │
│ ...                                                               │
│                                                                   │
│ [Today]                                                          │
└───────────────────────────────────────────────────────────────────┘
```

**Key components:** `WorkPackageCalendar`, `WorkPackageCalendarGrid`, custom hooks.
**Special:** Click date → "Add WP" popover. Click event chip → WP drawer.

#### 11.3.10 `/projects/[projectId]/wiki` (wiki/index.tsx)

**Purpose:** Wiki page list.

```
┌─ Page header: Wiki   [+ New page] ──────────────────────────────┐
│ ┌─ Sidebar (200px) ──┬─ Main ─────────────────────────────────┐│
│ │ Pages              │                                          ││
│ │  • Home            │  Welcome to the Mobile App wiki         ││
│ │  • Architecture    │  Last updated 2 days ago by Alex        ││
│ │  • API Reference   │                                          ││
│ │  • Onboarding      │  Recent pages                            ││
│ │  • Runbook         │  • Deployment  updated 1d ago           ││
│ │                    │  • Onboarding  updated 3d ago           ││
│ │ [+ New page]       │  • API changelog  updated 1w ago        ││
│ └────────────────────┴──────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Key components:** `WikiPageList`, `WikiPageView`, `WikiTableOfContents`, `WikiMacrosHelp`.
**Special:** Markdown content with TOC sidebar on the right (stuck to viewport).

#### 11.3.11 `/projects/[projectId]/wiki/[slug]` (wiki/[slug]/index.tsx)

```
┌─ Wiki header ──────────────────────────────────────────────────┐
│ Wiki / Architecture                  [Edit] [History] [⋯]       │
│ Last edited 3 days ago by Alex · v12                           │
│ ─────────────────────────────────────────────────────────────  │
│ ┌─ TOC (sticky, 200px) ─┬─ Content (max-w-3xl) ──────────────┐│
│ │ • Overview            │                                    ││
│ │ • Components          │  # Architecture                   ││
│ │ • Data flow           │                                    ││
│ │ • Deployment          │  ## Overview                       ││
│ │                       │  …                                 ││
│ │                       │  ## Components                     ││
│ │                       │  …                                 ││
│ └───────────────────────┴────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**Special:** `WikiVersionHistory` opens in a side drawer (not a modal). Inline comments inline at line level.

#### 11.3.12 `/projects/[projectId]/news` and `/new`, `/[slug]`

`/news` is a list of news cards (newest first).
`/new` is a form: title, summary, description (markdown).
`/[slug]` is the post detail with comments.

#### 11.3.13 `/projects/[projectId]/forums` (forums/index.tsx)

**Purpose:** Forum list (one per project by default, more possible).

```
┌─ Page header: Forums ──────────────────────────────────────────┐
│ ┌─ Forum list ──────────────────────────────────────────────┐  │
│ │ 📢 Announcements       3 topics  12 posts   Last: 1d ago   │  │
│ │ 💬 General             28 topics  142 posts  Last: 3h ago  │  │
│ │ ❓ Help & Support      12 topics  47 posts   Last: 12h ago │  │
│ │ [+ New forum]                                              │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Key components:** `ForumList`, `ForumCard`.

#### 11.3.14 `/projects/[projectId]/forums/[forumId]` (forum detail)

```
┌─ Breadcrumb: ... / Forums / General ───────────────────────────┐
│ General forum        [Subscribe] [+ New thread]                 │
│ ┌─ Sticky ──────────────────────────────────────────────────┐  │
│ │ 📌 Welcome to the forum  by Alex  3d ago   12 replies  ⭐ │  │
│ ├──────────────────────────────────────────────────────────┤  │
│ │ 🗨 OAuth setup issue     by Bob   3h ago    4 replies    │  │
│ │ 🗨 Sprint retrospective  by Jane  1d ago    18 replies   │  │
│ │ 🗨 iOS 18 testing        by Alex  2d ago    7 replies    │  │
│ │ ...                                                        │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                          [< 1 / 3 >]            │
└─────────────────────────────────────────────────────────────────┘
```

#### 11.3.15 `/projects/[projectId]/forums/[forumId]/threads/[threadId]`

**Layout:** thread view with original post on top, replies below, reply composer at bottom (sticky).

#### 11.3.16 `/projects/[projectId]/documents` and `/new`

**Layout:** File browser with folder tree on the left, file grid on the right. Drag-and-drop upload to current folder.

#### 11.3.17 `/projects/[projectId]/members` (members/index.tsx)

```
┌─ Page header: Members  [Filter: All ▼] [+ Add member] ──────────┐
│ ┌─ Member list ──────────────────────────────────────────────┐  │
│ │  [👤] Alex Admin       alex@acme.com   Administrator  ⋯    │  │
│ │       admin / dev / design                                │  │
│ │  [👤] Jane Architect   jane@acme.com   Senior dev     ⋯    │  │
│ │  [👤] Bob Dev          bob@acme.com    Developer      ⋯    │  │
│ │  [👤] Design Team      4 members       Group          ⋯    │  │
│ │  ...                                                        │  │
│ └────────────────────────────────────────────────────────────┘  │
│ 8 members (3 users, 1 group)                                    │
└────────────────────────────────────────────────────────────────┘
```

**Key components:** `MemberList`, `MemberCard`, `AvatarGroup`, role pill.

#### 11.3.18 `/projects/[projectId]/budgets` and `/[id]`

`/budgets` — list of budgets (cards with spent/planned bar).
`/[id]` — budget detail with line items table + report chart.

#### 11.3.19 `/projects/[projectId]/backlogs` (backlogs/index.tsx)

**Purpose:** Scrum backlogs (sprint planning).

```
┌─ Sidebar: Sprints ──┬─ Active sprint backlog ──────────────────┐
│ ▶ Sprint 23 (done)  │ ┌─ Story ─────────────────────────────┐ │
│ ▶ Sprint 24 (active)│ │ #452  Add OAuth flow        13 SP  │ │
│   24 of 32 SP used  │ │       [JA] [BB]                      │ │
│   [Burndown]         │ │  [Tasks: 3/5 done]                  │ │
│ ▶ Sprint 25 (plan)   │ └────────────────────────────────────┘ │
│ [+ New sprint]       │ ┌─ Story ─────────────────────────────┐ │
│                      │ │ #451  Fix login redirect    5 SP   │ │
│                      │ └────────────────────────────────────┘ │
│                      │                                          │
│                      │ Total: 18 SP                            │
└──────────────────────┴──────────────────────────────────────────┘
```

**Key components:** `SprintCard`, `BurndownChart`, `SprintBoard`.
**Special:** Drag stories between sprints; clicking story expands its child tasks inline.

#### 11.3.20 `/projects/[projectId]/meetings` and `/[id]`, `/[id]/edit`

`/meetings` — list of meeting cards (past + upcoming).
`/[id]` — meeting detail with two tabs: Agenda and Minutes. Each tab has an editor.
`/[id]/edit` — meeting form.

#### 11.3.21 `/projects/[projectId]/news` (already covered 11.3.12)

#### 11.3.22 `/projects/[projectId]/repository` and `/[repoId]`

`/repository` — repo list.
`/[repoId]` — file tree + readme. Click file → file viewer. (Limited to read-only display; actual git is external.)

#### 11.3.23 `/projects/[projectId]/search` (search.tsx)

**Layout:** Project-scoped search results page. Same as global search but filtered to current project.

#### 11.3.24 `/projects/[projectId]/settings` (settings.tsx)

**Purpose:** Project-level settings (one big form, sub-nav on left).

```
┌─ Settings ─────────────────────────────────────────────────────┐
│ ┌─ Sub-nav (200px) ───┬─ Active section ──────────────────────┐│
│  Project info         │                                         ││
│  Modules              │  # Project info                         ││
│  Members              │                                         ││
│  Versions             │  ┌─ Name * ──────────────────────┐    ││
│  Categories           │  └────────────────────────────────┘    ││
│  Work package types   │  ┌─ Identifier * ───────────────┐    ││
│  Workflow             │  └────────────────────────────────┘    ││
│  Custom fields        │  ...                                     ││
│  Repositories         │                                         ││
│  Forks                │                                         ││
│  ⚠ Delete project     │                                         ││
└───────────────────────┴─────────────────────────────────────────┘
```

### 11.4 My Page (1 page)

#### 11.4.1 `/my-page` (my-page.tsx)

**Purpose:** Personal dashboard with configurable widgets.

```
┌─ Page header: My page   [Edit layout] ─────────────────────────┐
│ ┌─ Widget: Assigned WPs ──┬─ Widget: This week's time ────────┐│
│ │ 12 open  [list]         │ [progress bar 10/40h]             ││
│ └─────────────────────────┴────────────────────────────────────┘│
│ ┌─ Widget: Upcoming meetings ─┬─ Widget: Recent mentions ─────┐│
│ │ • 3pm Sprint planning       │ @bob mentioned you in #451     ││
│ │ • 4pm 1:1 Alex              │ @jane replied to your comment  ││
│ └─────────────────────────────┴────────────────────────────────┘│
│ [+ Add widget]                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key components:** `MyPageWidget`, `AssignedWorkPackagesWidget`, `TimeEntriesWidget`, `UpcomingMeetingsWidget`.
**Special:** "Edit layout" enables drag-to-reorder + add/remove widget. State persisted server-side.

### 11.5 Notifications (1 page)

#### 11.5.1 `/notifications` (notifications/index.tsx)

**Layout:**

```
┌─ Page header: Notifications  [Filter: All ▼] [Mark all read] ──┐
│ [All] [Unread 3] [Mentions] [Watching] [Assigned]              │
│ ─────────────────────────────────────────────────────────────  │
│ ⚠ Bob assigned WP #452 to you       2 minutes ago    [Open]   │
│   "Add OAuth flow"                                           │
│ 💬 Jane replied to your comment on #451  1 hour ago  [Open]   │
│ ℹ️ Sprint planning in 30 minutes             30m ago    [Open] │
│ ✅ WP #450 was merged                          2h ago     [Open] │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

**Special:** The same data is also surfaced via the global `NotificationBell` in the topbar (popover with last 5, "See all" link to this page).

### 11.6 Help (3 pages)

`/help`, `/help/getting-started`, `/help/shortcuts` — simple docs pages with sidebar nav and a content area. `/help/shortcuts` renders the full keyboard shortcut cheat sheet in a searchable grid.

### 11.7 Settings (1 page + 1 admin) (3 pages)

#### 11.7.1 `/settings/security` (settings/security.tsx)

**Purpose:** User security settings: password change, 2FA, active sessions, API tokens.

```
┌─ Page header: Security ─────────────────────────────────────────┐
│ ┌─ Section: Password ────────────────────────────────────────┐│
│ │ Current: [••••••••]                                         ││
│ │ New:     [••••••••]  [strength bar]                        ││
│ │ Confirm: [••••••••]                                         ││
│ │ [Update password]                                           ││
│ └─────────────────────────────────────────────────────────────┘│
│ ┌─ Section: Two-factor authentication ──────────────────────┐  │
│ │ Status: Enabled ✓                                           │  │
│ │ [Reconfigure] [Disable]                                     │  │
│ └─────────────────────────────────────────────────────────────┘  │
│ ┌─ Section: Active sessions ────────────────────────────────┐  │
│ │ 🌐 Chrome on macOS     IP 1.2.3.4   Last active 2m ago [×] │  │
│ │ 📱 iOS app             IP 5.6.7.8   Last active 1d ago [×] │  │
│ │ ...                                                          │  │
│ │ [Sign out all other sessions]                              │  │
│ └─────────────────────────────────────────────────────────────┘  │
│ ┌─ Section: API tokens ──────────────────────────────────────┐  │
│ │ + Generate new token                                        │  │
│ │ Name                Last used      Scopes      Actions      │  │
│ │ CI bot              2h ago         read,write [Revoke]      │  │
│ └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

#### 11.7.2 `/admin/dashboard` (admin/dashboard.tsx)

Already covered in 11.2.2 — admin-only variant.

#### 11.7.3 `/admin/authentication/ldap` and `/admin/authentication/oauth`

LDAP server config list, add/edit form with test connection, sync now action, attribute mapping.
OAuth provider list, add/edit form with client_id/secret, callback URL, scope config.

### 11.8 Admin (16 pages)

#### 11.8.1 `/admin/announcements` (announcements/index.tsx)

**Purpose:** Manage site-wide announcement banners.

**Layout:** List of announcements (active/draft/expired) with add/edit drawer for each.

#### 11.8.2 `/admin/custom-fields` and `/[id]/edit`

`/custom-fields` — list of custom fields by type (WorkPackage, Project, User, etc.).
`/[id]/edit` — form: name, type (text/int/date/user/list/boolean), format, regexp, default, used in (WP types), required.

#### 11.8.3 `/admin/groups` and `/[id]`

`/groups` — list of groups.
`/[id]` — group detail: members, group-of-groups, projects they have access to.

#### 11.8.4 `/admin/project-templates` and `/[id]/edit`

**Purpose:** Manage project templates (used when "Create from template" is selected).

`/project-templates` — list of templates (cards).
`/[id]/edit` — full project form pre-filled, plus toggle "is template".

#### 11.8.5 `/admin/settings/branding`

**Purpose:** Custom logo, colors, login screen text.

**Layout:** Two-column form with live preview on the right (login page mockup).

#### 11.8.6 `/admin/webhooks`

**Purpose:** Webhook management.

**Layout:** List of webhooks (name, URL, events, status, last delivery). Click → detail with delivery log.

### 11.9 Other

#### 11.9.1 `/notifications` — see 11.5

#### 11.9.2 `/my-page` — see 11.4

#### 11.9.3 `/dashboard` — see 11.2

#### 11.9.4 `/login` — see 11.1

---

## 12. State Diagrams

### 12.1 Work package lifecycle

```
              ┌─────────┐
   draft ──▶ │   New   │
              └────┬────┘
                   │ start work
                   ▼
              ┌─────────┐    block / on-hold   ┌──────────┐
              │   In    │ ────────────────────▶│ On hold  │
              │ progress│                        └─────┬────┘
              └────┬────┘                              │ resume
                   │                                    │
                   │ request review                     │
                   ▼                                    │
              ┌─────────┐                               │
              │  In     │                               │
              │ review  │                               │
              └────┬────┘                               │
       approve    │     │ reject                        │
                  ▼     ▼                               │
              ┌─────────┐  ┌─────────┐                  │
              │  Done   │  │Rejected │                  │
              └────┬────┘  └────┬────┘                  │
                   │           │                        │
                   │ archive   │                        │
                   ▼           ▼                        │
              ┌──────────────────┐                      │
              │     Closed       │ ◀────────────────────┘
              └──────────────────┘
                   │ reopen
                   └──▶ (back to New or last active)
```

**Allowed transitions** are configured per-workflow (one per WP type per project). The UI shows only valid "next status" options in the status dropdown.

**Side effects on transitions:**
- New → In progress: assign default watcher; notify assignee
- In progress → In review: notify watchers
- In review → Done (approve): set % done to 100, set finish date, notify watchers
- In review → Rejected: set % done to last value, notify author
- Done → Closed: lock editing, archive
- Any → On hold: notify assignee + watchers
- On hold → (prior): clear blocked reason

### 12.2 Project creation

```
                    ┌────────────────┐
   user clicks "+"  │                │
   or "New project" │   Idle         │
                    │                │
                    └────────┬───────┘
                             │ open form
                             ▼
                    ┌────────────────┐
                    │   Form open    │
                    │   (draft)      │  ← autosave on field blur
                    └────────┬───────┘
                             │ submit
                             ▼
                    ┌────────────────┐
                    │  Validating    │
                    └────────┬───────┘
                             │ ok
                             ▼
                    ┌────────────────┐
                    │  Creating      │  POST /api/projects
                    │  (server)      │
                    └────────┬───────┘
                             │
              success        │        failure
                │            │           │
                ▼            │           ▼
        ┌──────────────┐     │   ┌────────────────┐
        │  Created     │     │   │  Error         │
        │  → redirect   │     │   │  (toast)       │
        │  to /projects/│     │   │  (form stays   │
        │  [id]        │     │   │   open)        │
        └──────────────┘     │   └────────────────┘
                             │
                             ▼
                    (in projects list: optimistic insert)
```

**Edge cases:**
- Duplicate identifier → highlight field, show "Already taken"
- Permissions check before submit (disabled form with explanation if no permission)
- Long creation (>2s) → progress bar modal with cancel

### 12.3 Member invitation

```
                ┌──────────────────────┐
admin/types     │                      │
email + role    │   Idle (form open)   │
                │                      │
                └──────────┬───────────┘
                           │ submit
                           ▼
                ┌──────────────────────┐
                │   Searching user     │
                │   (if email matches  │
                │   existing user)     │
                └──────────┬───────────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
   ┌────────────────────┐    ┌────────────────────┐
   │ User exists        │    │ User doesn't exist │
   │ → add as member    │    │ → send invite email│
   │ → notify user      │    │ → status: invited  │
   └──────────┬─────────┘    └──────────┬─────────┘
              │                          │
              ▼                          ▼
   ┌────────────────────┐    ┌────────────────────┐
   │ Member (active)    │    │ Invited (pending)   │
   │                    │    │ TTL: 14 days        │
   └────────────────────┘    └──────────┬─────────┘
                                        │ on accept
                                        ▼
                              ┌────────────────────┐
                              │ User creates acct  │
                              │ → becomes Member   │
                              └────────────────────┘
                                        │ on decline / expire
                                        ▼
                              ┌────────────────────┐
                              │ Invite revoked     │
                              └────────────────────┘
```

**UI states:**
- Idle: form with email + role selector + optional "send welcome message" toggle
- Searching user: brief spinner inside form
- Added existing: success toast "Added Jane as Developer"
- Sent invite: success toast "Invite sent to jane@external.com"
- Resend invite: secondary action on row
- Revoke: destructive in row menu

### 12.4 Notification flow

```
    Source event                 Delivery                   User action
    ─────────────                ────────                   ───────────
                                                    
   WP assigned        ┌──────────────────────┐      ┌─────────────────┐
   ──────────────▶    │   Server (event bus)  │ ───▶ │  In-app (real-  │
                      │   saves to DB         │      │  time + push)   │
   Comment @mention   │   creates row in      │      └────────┬────────┘
   ──────────────▶    │   Notification table  │               │
                      │                       │      ┌────────▼────────┐
   WP due in 24h      │   dispatches to:      │      │  Email (digest  │
   ──────────────▶    │   • in-app            │      │  or instant)    │
                      │   • email (per user   │      └────────┬────────┘
   WP status changed  │     preference)       │               │
   ──────────────▶    │   • push (per user    │      ┌────────▼────────┐
                      │     preference)       │      │  Web push (per  │
   ...                │   • web (SSE)         │      │  user pref)     │
                      └──────────────────────┘      └────────┬────────┘
                                                               │
   User preference                                              ▼
   (Settings > Notifications)                        ┌─────────────────────┐
   ──────────────────────────────                    │  NotificationCenter │
   Per-type toggle (in-app, email, push)             │  + bell badge       │
   Per-WP watch toggle                               │  + full list page   │
   Quiet hours (Do Not Disturb)                       └─────────────────────┘
   Digest mode (daily / weekly / off)
```

**Read state:**
- Unread: blue dot, bolded text, badge count
- Marked read: on click, on `/notifications` visit, on "Mark all read"
- Marked unread: long-press / kebab menu

**Preferences UI** lives at `/settings/notifications` (new page, see §18).

---

## 13. Loading, Empty, Error States

### 13.1 Loading state strategy

| Content shape | Use skeleton? | Use spinner? | Notes |
|---------------|---------------|--------------|-------|
| Known shape (list, card, table row) | ✅ exact-shape skeleton | ❌ | 200ms shimmer, then static |
| Unknown shape (full page first load) | ❌ | ✅ centered spinner | max 5s, then error |
| Initial paint of dashboard widgets | ✅ widget-shape skeleton | ❌ | one per widget, parallel |
| Inline action (button) | ❌ | ✅ button-internal spinner | aria-busy, disabled |
| Background refresh (TanStack Query) | ❌ | ✅ subtle 16px top-of-page progress bar | |
| Form submit | ❌ | ✅ button-internal | disable form |
| Drag/drop | ❌ | ❌ | cursor: grabbing + ghost card |
| Pagination "Load more" | ❌ | ✅ inline spinner | inside button |
| Infinite scroll | ❌ | ✅ bottom-of-list spinner | |

### 13.2 Skeleton design

- Color: `bg-slate-200` (light) / `bg-slate-800` (dark)
- Shimmer: OFF by default (causes motion sickness). ON only if expected wait > 2s.
- Shape mirrors final content (e.g., table row skeleton has 5 cells matching column widths)
- No pulsing, no gradient sweep

```tsx
// components/ui/Skeleton.tsx
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200 dark:bg-slate-800", className)} {...props} />;
}
```

### 13.3 Empty state design

Every collection view has a designed empty state, not just "No items".

**Template:**

```tsx
<EmptyState
  icon={<Inbox className="size-12" aria-hidden="true" />}
  title="No work packages yet"
  description="Track tasks, bugs, and features. Create your first one to get started."
  primaryAction={<Button leftIcon={<Plus />}>New work package</Button>}
  secondaryAction={<Button variant="link">Import from CSV</Button>}
/>
```

**Per-context empty states (defined):**

| Page | Title | Primary action |
|------|-------|----------------|
| `/projects` (no projects) | "Welcome! Let's create your first project" | "+ New project" |
| `/projects` (filtered) | "No projects match your filters" | "Clear filters" |
| `/projects/[id]/work-packages` | "Track work in this project" | "+ New work package" |
| `/projects/[id]/wiki` (no pages) | "Build your project knowledge base" | "+ New wiki page" |
| `/projects/[id]/forums` | "Start a discussion" | "+ New forum" or "+ New thread" |
| `/projects/[id]/members` (no members) | "Invite your team" | "+ Add member" |
| `/notifications` | "No notifications" | "Browse projects →" |
| `/my-page` (no widgets) | "Customize your dashboard" | "+ Add widget" |
| Search results (no hits) | `No results for "OAuth flow"` | "Clear search" |
| Wiki search | "No pages match" | "Create page from this title" |
| Activity (filtered empty) | "No activity in this period" | "Clear date filter" |
| Repository (no files) | "This repository is empty" | n/a |
| Documents (no folders) | "Organize your files" | "+ New folder" |

### 13.4 Error state design

Three layers:

1. **Inline form error**: red border + error message below field; `aria-invalid`, `aria-describedby`.
2. **Section error**: card with `Alert variant="error"` + retry button.
3. **Page error**: full-page `ErrorBoundary` fallback with friendly message + home link.

```tsx
// components/common/ErrorBoundary.tsx (existing — extend)
<div className="grid min-h-[60vh] place-items-center p-8">
  <Card className="max-w-md text-center">
    <AlertTriangle className="mx-auto size-12 text-error-500" aria-hidden="true" />
    <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
    <p className="mt-2 text-sm text-text-muted">
      {error.message || "An unexpected error occurred. Our team has been notified."}
    </p>
    <div className="mt-6 flex justify-center gap-2">
      <Button variant="outline" onClick={reset}>Try again</Button>
      <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
    </div>
  </Card>
</div>
```

**4xx errors:**
- 401 → redirect to `/login?next=…`
- 403 → full-page "You don't have permission" with "Request access" mailto
- 404 → full-page "Not found" with search bar + back link
- 429 → toast "Too many requests" with retry-after countdown
- 5xx → page-level error boundary

**Network error (offline):**
- Top banner: "You're offline. Changes will sync when you reconnect."
- All write actions queue in IndexedDB (Phase 6)
- TanStack Query pauses fetching

---

## 14. Mobile Responsive Strategy

### 14.1 Core principles

1. **Layout, not lamination**: the same information, reorganized. Not a separate mobile app.
2. **Touch targets ≥ 44×44 px** for all interactive elements.
3. **Gestures supplement, never replace**: a tap always works; a swipe is a bonus.
4. **Bottom sheet over modal on mobile**: easier to dismiss with thumb.
5. **Sidebar becomes a drawer**: hamburger opens full-height left drawer with project context.

### 14.2 Per-breakpoint behavior

| Element | Mobile (<640) | Tablet (640-1024) | Desktop (1024+) |
|---------|---------------|-------------------|-----------------|
| Sidebar | hidden → drawer | icon-rail (64px) | full sidebar (240px) |
| Topbar | logo + avatar menu | logo + search + avatar | full |
| Page header | title + kebab menu | title + actions inline | title + actions inline |
| Tables | card list, key fields | condensed table (4 cols) | full table |
| WP detail | single column, sidebar collapsed below content | 2 col (main + sidebar) | 2 col (main + sidebar) |
| Board | horizontal scroll | 2-3 cols visible | all cols visible |
| Gantt | horizontal scroll, day zoom only | day/week zoom | day/week/month/quarter |
| Modals | bottom sheet | centered, 90% width | centered, max-w |
| Toolbars | wrap to 2 rows | 1 row, compress | 1 row, full |
| Filters | bottom sheet | popover | popover |
| Forms | single column | 2 column | 3 column |

### 14.3 Mobile-specific components

- **MobileNav**: drawer triggered by hamburger, contains main nav + project switcher
- **BottomSheet**: uses `vaul`, max height 90vh
- **SwipeActions**: swipe right on WP row → "Mark done", swipe left → "Delete" (with confirmation)
- **PullToRefresh**: at top of list, refreshes
- **StickyBottomAction**: form save button sticks to bottom on mobile

### 14.4 Table → card transformation

Tables transform to a vertical card list on mobile. Each card shows:
- Primary: subject (with type icon)
- Secondary: status pill + assignee avatar
- Meta: due date, ID
- Trailing: kebab menu

```tsx
{/* Mobile card */}
<Link href={...} className="block rounded-md border border-border-subtle p-3 active:bg-slate-50">
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{wp.subject}</p>
      <p className="mt-0.5 text-xs text-text-muted">#{wp.id} · {wp.type.name}</p>
    </div>
    <DropdownMenu>...</DropdownMenu>
  </div>
  <div className="mt-2 flex items-center gap-2">
    <StatusBadge status={wp.status} />
    <Avatar name={wp.assignee.name} size="xs" />
    <span className="ml-auto text-xs text-text-muted">{formatRelative(wp.dueDate)}</span>
  </div>
</Link>
```

---

## 15. Tailwind v4 Implementation Guide

### 15.1 Why Tailwind v4 specifically

Tailwind v4 introduces:
- CSS-first config (`@theme` blocks) — no more `tailwind.config.js`
- Native CSS variables, no `var(--tw-…)` indirection
- Lightning CSS engine, ~10× faster builds
- `data-attribute` variants (e.g., `data-[state=open]:`)
- Container queries built-in

### 15.2 The `globals.css` (full token block)

```css
/* styles/globals.css */
@import "tailwindcss";

/* ─── Light theme (default) ─────────────────────────────────────── */
:root {
  /* Brand: Indigo */
  --color-primary-50:  #EEF2FF;
  --color-primary-100: #E0E7FF;
  --color-primary-200: #C7D2FE;
  --color-primary-300: #A5B4FC;
  --color-primary-400: #818CF8;
  --color-primary-500: #6366F1;
  --color-primary-600: #4F46E5;
  --color-primary-700: #4338CA;
  --color-primary-800: #3730A3;
  --color-primary-900: #312E81;

  /* Neutral: Slate */
  --color-slate-0:   #FFFFFF;
  --color-slate-50:  #F8FAFC;
  --color-slate-100: #F1F5F9;
  --color-slate-200: #E2E8F0;
  --color-slate-300: #CBD5E1;
  --color-slate-400: #94A3B8;
  --color-slate-500: #64748B;
  --color-slate-600: #475569;
  --color-slate-700: #334155;
  --color-slate-800: #1E293B;
  --color-slate-900: #0F172A;
  --color-slate-950: #020617;

  /* Semantic */
  --color-success-100: #DCFCE7; --color-success-600: #16A34A; --color-success-700: #15803D;
  --color-warning-100: #FEF3C7; --color-warning-600: #D97706; --color-warning-700: #B45309;
  --color-error-100:   #FEE2E2; --color-error-600:   #DC2626; --color-error-700:   #B91C1C;
  --color-info-100:    #E0F2FE; --color-info-600:    #0284C7; --color-info-700:    #0369A1;

  /* Surfaces */
  --color-surface-canvas:  var(--color-slate-50);
  --color-surface-raised:  #FFFFFF;
  --color-surface-sunken:  var(--color-slate-100);
  --color-surface-overlay: rgb(15 23 42 / 0.6);
  --color-surface-sidebar: #FFFFFF;
  --color-surface-topbar:  #FFFFFF;

  /* Text */
  --color-text-default:  var(--color-slate-900);
  --color-text-muted:    var(--color-slate-600);
  --color-text-subtle:   var(--color-slate-500);
  --color-text-onPrimary: #FFFFFF;
  --color-text-link:     var(--color-primary-700);

  /* Borders */
  --color-border-subtle:  var(--color-slate-200);
  --color-border-default: var(--color-slate-300);
  --color-border-strong:  var(--color-slate-400);
  --color-border-focus:   var(--color-primary-600);
  --color-border-divider: var(--color-slate-100);

  /* Status */
  --color-status-new:        var(--color-slate-500);  --color-status-new-bg:        var(--color-slate-100);
  --color-status-in-progress: var(--color-info-600);  --color-status-in-progress-bg: var(--color-info-100);
  --color-status-in-review:  #9333EA;                  --color-status-in-review-bg:  #F3E8FF;
  --color-status-done:       var(--color-success-600); --color-status-done-bg:       var(--color-success-100);
  --color-status-closed:     var(--color-slate-900);  --color-status-closed-bg:     var(--color-slate-200);
  --color-status-on-hold:    var(--color-warning-600); --color-status-on-hold-bg:    var(--color-warning-100);
  --color-status-rejected:   var(--color-error-600);   --color-status-rejected-bg:   var(--color-error-100);

  /* Typography */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;

  --text-2xs: 0.6875rem;  /* 11 */
  --text-xs:  0.75rem;    /* 12 */
  --text-sm:  0.875rem;   /* 14 */
  --text-base:1rem;       /* 16 */
  --text-lg:  1.125rem;   /* 18 */
  --text-xl:  1.25rem;    /* 20 */
  --text-2xl: 1.5rem;     /* 24 */
  --text-3xl: 1.875rem;   /* 30 */
  --text-display: 2.25rem;
  --text-display-lg: 3rem;

  --leading-tight: 1.25;
  --leading-snug:  1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* Spacing (4-px scale) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.05);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.12), 0 8px 10px -6px rgb(0 0 0 / 0.05);

  /* Motion */
  --duration-instant: 0ms;
  --duration-fast:    120ms;
  --duration-base:    200ms;
  --duration-slow:    300ms;
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:     cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* Z-index */
  --z-base: 0; --z-raised: 10; --z-sticky: 20; --z-drawer: 30;
  --z-dropdown: 40; --z-modal: 50; --z-modal-content: 51;
  --z-toast: 60; --z-tooltip: 70;
}

/* ─── Dark theme (auto via [data-theme="dark"]) ─────────────────── */
[data-theme="dark"] {
  --color-slate-0:   #0B0F1A;
  --color-slate-50:  #0F172A;
  --color-slate-100: #1E293B;
  --color-slate-200: #334155;
  --color-slate-300: #475569;
  --color-slate-400: #64748B;
  --color-slate-500: #94A3B8;
  --color-slate-600: #CBD5E1;
  --color-slate-700: #E2E8F0;
  --color-slate-800: #F1F5F9;
  --color-slate-900: #F8FAFC;
  --color-slate-950: #FFFFFF;

  --color-primary-500: #6366F1;
  --color-primary-600: #818CF8;
  --color-primary-700: #A5B4FC;
  --color-primary-800: #C7D2FE;
  --color-primary-900: #E0E7FF;

  --color-success-100: #052E16; --color-success-600: #4ADE80; --color-success-700: #86EFAC;
  --color-warning-100: #451A03; --color-warning-600: #FBBF24; --color-warning-700: #FCD34D;
  --color-error-100:   #450A0A; --color-error-600:   #F87171; --color-error-700:   #FCA5A5;
  --color-info-100:    #082F49; --color-info-600:    #38BDF8; --color-info-700:    #7DD3FC;

  --color-surface-canvas:  var(--color-slate-950);
  --color-surface-raised:  var(--color-slate-900);
  --color-surface-sunken:  var(--color-slate-950);
  --color-surface-overlay: rgb(0 0 0 / 0.7);
  --color-surface-sidebar: var(--color-slate-900);
  --color-surface-topbar:  var(--color-slate-900);

  --color-text-default: var(--color-slate-50);
  --color-text-muted:   var(--color-slate-400);
  --color-text-subtle:  var(--color-slate-500);
  --color-text-link:    var(--color-primary-300);

  --color-border-subtle:  var(--color-slate-800);
  --color-border-default: var(--color-slate-700);
  --color-border-strong:  var(--color-slate-600);
  --color-border-focus:   var(--color-primary-400);
  --color-border-divider: var(--color-slate-800);

  --color-status-new:        var(--color-slate-400);  --color-status-new-bg:        var(--color-slate-800);
  --color-status-in-progress: var(--color-info-400);   --color-status-in-progress-bg: var(--color-info-100);
  --color-status-in-review:  #C084FC;                  --color-status-in-review-bg:  #581C87;
  --color-status-done:       var(--color-success-400); --color-status-done-bg:       var(--color-success-100);
  --color-status-closed:     var(--color-slate-200);  --color-status-closed-bg:     var(--color-slate-800);
  --color-status-on-hold:    var(--color-warning-400); --color-status-on-hold-bg:    var(--color-warning-100);
  --color-status-rejected:   var(--color-error-400);   --color-status-rejected-bg:   var(--color-error-100);

  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.4);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.5);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.6);
}

/* ─── Expose tokens to Tailwind v4 utility classes ─────────────── */
@theme inline {
  --color-primary-50:  var(--color-primary-50);
  --color-primary-100: var(--color-primary-100);
  /* … repeat for all tokens … */
  --color-surface-canvas:  var(--color-surface-canvas);
  --color-surface-raised:  var(--color-surface-raised);
  /* etc. */

  --color-ring: var(--color-border-focus);

  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);

  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

/* ─── Global resets & base styles ──────────────────────────────── */
* { border-color: var(--color-border-default); }
html, body { height: 100%; }
body {
  background-color: var(--color-surface-canvas);
  color: var(--color-text-default);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  line-height: 1.43;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* ─── Focus ring ──────────────────────────────────────────────── */
:focus { outline: none; }
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
  border-radius: inherit;
}

/* ─── Selection ───────────────────────────────────────────────── */
::selection { background: var(--color-primary-200); color: var(--color-primary-900); }

/* ─── Scrollbar ───────────────────────────────────────────────── */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--color-slate-300);
  border-radius: 5px;
  border: 2px solid var(--color-surface-canvas);
}
::-webkit-scrollbar-thumb:hover { background: var(--color-slate-400); }

/* ─── Reduced motion ──────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 15.3 Utility-class usage patterns

**Color:**

```tsx
<div className="bg-surface-canvas text-text-default">
<Button className="bg-primary-600 hover:bg-primary-700 text-text-onPrimary">
<Badge tone="success">  // resolves to bg-success-100 text-success-700
```

**Spacing:**

```tsx
<Card className="p-6 space-y-4">   // 24px padding, 16px gap
<div className="mt-2 mb-4">        // never mix ms/me with ml/mr on the same axis
```

**Typography:**

```tsx
<h1 className="text-3xl font-bold tracking-tight">Page title</h1>
<p className="text-sm text-text-muted">Helper text</p>
<code className="font-mono text-xs">yarn dev</code>
```

**Layout:**

```tsx
<main className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
<aside className="sticky top-16 h-[calc(100vh-4rem)]">
```

**State:**

```tsx
<button className="data-[state=open]:bg-slate-100 aria-[current=page]:bg-primary-50">
<input className="aria-[invalid=true]:border-error-500" />
```

**Group hover / focus:**

```tsx
<a className="group flex items-center gap-2 rounded-md p-2 hover:bg-slate-100">
  <Icon className="size-4 text-text-muted group-hover:text-text-default" />
  <span>Link</span>
</a>
```

### 15.4 Custom utilities (extend `@utility`)

```css
@utility focus-ring {
  &:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }
}

@utility tabular {
  font-variant-numeric: tabular-nums;
}

@utility scrollbar-thin {
  &::-webkit-scrollbar { width: 6px; height: 6px; }
}
```

### 15.5 The `cn()` helper

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 15.6 Plugin set

```json
// package.json (devDeps)
{
  "tailwindcss": "^4.0.0",
  "@tailwindcss/postcss": "^4.0.0",
  "@tailwindcss/forms": "^0.5.9",        // form resets (minimal)
  "@tailwindcss/typography": "^0.5.15",  // prose for wiki/news
  "tailwind-merge": "^2.5.4",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.1",
  "tailwindcss-animate": "^1.0.7"
}
```

### 15.7 Per-feature class composition

We do **not** use CSS modules. Each component owns its classes inline. Repeated patterns are extracted into tiny `cn()` helpers within the component file.

**Anti-pattern:** a `globals.css` with 400 lines of `.wp-card { ... }` style classes. We reject that.

---

## 16. Theme Switching & Dark Mode

### 16.1 Theme strategy

Three modes: `light`, `dark`, `system`. The user's choice is stored:
1. `localStorage["openproject:theme"]` (client-only instant apply)
2. Server-side: cookie `theme`, syncs to `useSession` so SSR matches.

```tsx
// lib/theme.ts
export type Theme = "light" | "dark" | "system";

export function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.cookie = `theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
}
```

### 16.2 FOUC prevention

In `_document.tsx`, before any paint, we set the theme based on cookie or system:

```html
<script dangerouslySetInnerHTML={{__html: `
  (function() {
    try {
      var t = document.cookie.match(/theme=(light|dark|system)/)?.[1] || 'system';
      var r = t === 'system'
        ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : t;
      document.documentElement.dataset.theme = r;
      document.documentElement.style.colorScheme = r;
    } catch (e) {}
  })();
`}} />
```

### 16.3 Dark mode aesthetic rules

- **Avoid pure black** (`#000`) for backgrounds — it creates harsh contrast with text. Use slate-950 (`#020617`) for canvas, slate-900 (`#0F172A`) for raised.
- **Reduce shadow intensity** — shadows are less visible on dark; rely more on borders.
- **Bump down saturation** of semantic colors. The light-mode Success 600 (`#16A34A`) becomes Success 400 (`#4ADE80`).
- **Disable backdrop blur on dark** — it looks muddy. Solid `bg-surface-overlay` only.
- **Logo**: invert the brand logo to white in dark mode (handled by SVG `currentColor`).

### 16.4 Theme toggle UI

Three-state toggle in user menu: `Light | Dark | System` with icons (`Sun` / `Moon` / `Monitor`).

---

## 17. Comparison: Original OpenProject vs Rewrite v2

### 17.1 What we IMPROVE (rewrite only)

| Area | Original (Rails) | Rewrite v2 |
|------|-----------------|-----------|
| **Page load** | Multi-second TTFB, server-rendered ERB | Next.js 15 streaming, TTFB < 200ms |
| **Table density** | 40px+ rows, soft colors, lots of vertical space | 32px rows, neutral chrome, data-first |
| **Inline editing** | Always opens a full page or modal | Click cell → edit → save on blur |
| **Dark mode** | None (OpenProject added it in v13; limited) | Full tokenized dark mode from day 1 |
| **Keyboard nav** | Partial (`j/k` in some lists) | Comprehensive (g + key navigation, cmd-K, etc) |
| **Mobile** | "Works but isn't great" | First-class responsive, drawer pattern |
| **Empty states** | Plain text | Designed empty states with primary action |
| **Loading** | Spinner overlay | Skeletons matching final shape |
| **Design tokens** | SCSS variables, scattered | Single `globals.css` source of truth |
| **Status pills** | Colorful circles + text | Unified StatusBadge component |
| **A11y** | Improving, but inconsistent | WCAG 2.1 AA floor, axe-core CI gate |
| **Form UX** | Submit-then-validate | Inline validation, save-on-blur |
| **Notifications** | Modal list, infrequent polling | Real-time SSE, popover + dedicated page |
| **Command palette** | None | `⌘K` everywhere |
| **Focus rings** | Sometimes missing | Always present, 2px primary |
| **Responsive tables** | Horizontal scroll | Card list on mobile |

### 17.2 What we KEEP (carry over from original)

- **Information architecture** — same modules, same navigation names. Users coming from Rails OpenProject feel at home.
- **Project hierarchy** — same parent/child relationships and `identifier` convention.
- **Work package types + workflow** — same concept of WP type → workflow → status. We just visualize it better.
- **Custom fields** — same model (text/int/date/user/list/boolean), same "used in" relationship to WP types.
- **Permissions** — same role × permission × project matrix. We make the admin UI clearer.
- **Time tracking model** — same time entries, same approval workflow.
- **Wiki versioning** — same content-addressed version history.
- **Gantt semantics** — start, finish, due date, predecessor/successor relations.
- **Backlogs / Sprints** — same Scrum model (sprint, story points, burndown).
- **Forum + voting** — same threaded model.
- **Announcement system** — same banner + dismiss concept.
- **Branding settings** — same custom logo + primary color.
- **LDAP / OAuth** — same auth providers and config fields.

### 17.3 What we REMOVE (intentional simplifications)

| Original feature | Why we remove | Migration |
|------------------|---------------|-----------|
| **Timelines module** | Enterprise-only Gantt, very heavy | We have a normal Gantt — sufficient for 95% of cases |
| **Backlogs custom queries** | Overlap with saved WP queries | Replaced by `QuerySwitcher` |
| **Custom logo upload via FTP** | Legacy | Admin > Branding > Logo upload (multipart) |
| **Color-coded enum custom fields** | We use a separate status system | Status enum (admin-configurable per type) |
| **Repository module git integration** | Out of scope; very few used it | Show repository metadata only (read-only) |
| **Multilingual wiki** | i18n complexity | Single-language per project for v2 |
| **Email-in / mail gateway** | Spam vector | Replaced by `@-mentions` in comments |
| **Calendar subscriptions (iCal)** | Limited utility | Replaced by Apple/Google Calendar push (planned) |
| **Per-WP category hierarchy >2 levels** | UI complexity | Flat categories + tags |
| **"Add spent time" for past days without restriction** | Audit issues | Limited to last 90 days by default; admin-configurable |
| **Static export of work packages to PDF** | Expensive, low value | CSV / XLSX / PDF (planned) export to filtered query |
| **Custom styles per project** | Inconsistent UX | Removed; branding is instance-wide |
| **News attachments** | Confusing (news has comments but files?) | News has comments + optional hero image only |

### 17.4 What we ADD (net new in v2)

- **Real-time collaboration** — multi-user WP editing (Phase 6)
- **AI work package drafting** — paste a Jira URL or meeting notes, get WP suggestions
- **My Page drag-to-reorder** — not in original
- **Saved views shared with team** — better collaboration on queries
- **Sprint goal + retrospective template** — structured retro
- **Health indicators on project cards** — derived from % overdue WPs
- **Bulk edit via right-click context menu** in WP tables
- **Inline file upload** in WP description (drag image into editor)
- **Native keyboard shortcut editor** in `/help/shortcuts`
- **Slash commands in description editor** (`/table`, `/code`, `/mention`)
- **Advanced search with query DSL** (Phase 5)
- **Mobile share-sheet integration** (PWA, Phase 6)
- **Customizable user profile widgets** (new in `/my-page`)

---

## 18. Recommended New Pages (Beyond 52)

These are pages we recommend adding in v2 to close gaps with original OpenProject and address modern UX expectations. None of them exist in the current rewrite code.

| # | Route | Purpose | Priority |
|---|-------|---------|----------|
| 1 | `/register` | Self-service signup (if enabled per instance) | High |
| 2 | `/forgot-password` | Password reset request | High |
| 3 | `/reset-password?token=…` | Password reset form | High |
| 4 | `/settings/profile` | User profile (name, avatar, email, language, timezone) | High |
| 5 | `/settings/notifications` | Granular notification preferences (per type × per channel) | High |
| 6 | `/settings/appearance` | Theme, density, language, sidebar collapse default | High |
| 7 | `/settings/sessions` | Active sessions (was bundled in `/settings/security`; deserves its own page) | Medium |
| 8 | `/settings/tokens` | API tokens list + create (extracted from security page) | High |
| 9 | `/admin/users` | User management (list, invite, deactivate) — was missing in current set | **Critical** |
| 10 | `/admin/users/[id]` | User detail: roles across projects, recent activity, impersonate | **Critical** |
| 11 | `/admin/roles` | Role & permission matrix editor | **Critical** |
| 12 | `/admin/roles/[id]` | Single role editor: name, permissions grid | **Critical** |
| 13 | `/admin/statuses` | Work package status list + workflow editor (transitions per type) | **Critical** |
| 14 | `/admin/types` | WP type editor (name, icon, color, attributes, custom fields) | **Critical** |
| 15 | `/admin/priorities` | Priority list (low/normal/high/urgent) | High |
| 16 | `/admin/workflows/[typeId]` | Visual workflow editor: which transitions are allowed for this type | High |
| 17 | `/admin/repositories` | Repository configuration | Medium |
| 18 | `/admin/colors` | Color picker admin for project/status/type colors | Low |
| 19 | `/admin/plugins` | Plugin list (future) | Low |
| 20 | `/admin/email` | Outbound email log + test send | Medium |
| 21 | `/admin/audit-log` | Audit trail of admin actions | Medium |
| 22 | `/admin/api` | API health, rate limits, v3 docs link | Low |
| 23 | `/onboarding` | First-run wizard for new users | High |
| 24 | `/profile/[userId]` | Public user profile (avatar, recent activity, current WPs) | Medium |
| 25 | `/search` (global) | Global search results with filters | **Critical** |
| 26 | `/integrations` | Third-party integrations hub (Slack, GitHub, Jira import) | High |
| 27 | `/integrations/slack` | Slack integration config | Medium |
| 28 | `/integrations/github` | GitHub integration config | Medium |
| 29 | `/projects/import` | Import from CSV / Jira | High |
| 30 | `/projects/templates` | Browse project templates | Medium |
| 31 | `/reports/global` | Cross-project reports (admin) | Medium |
| 32 | `/reports/time` | Time report (filter by user, project, date, billable) | High |
| 33 | `/admin/storage` | S3 / file storage config | Low |
| 34 | `/admin/backups` | Backup / restore (admin) | Low |
| 35 | `/admin/mail-notifications` | System-wide notification rules | Low |
| 36 | `/legal/privacy` | Privacy policy | Medium |
| 37 | `/legal/terms` | Terms of service | Medium |

**Most critical to add first:** users, roles, statuses, types, global search, notifications settings. These are admin/configuration surfaces that the app cannot function without for a real deployment.

---

## 19. Appendix: Code Patterns & Snippets

### 19.1 Hook: `useMediaQuery`

```ts
// hooks/use-media-query.ts
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const m = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", handler);
    setMatches(m.matches);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// usage
const isMobile = useMediaQuery("(max-width: 767px)");
```

### 19.2 Hook: `useTheme`

```ts
// hooks/use-theme.ts
import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme };
}
```

### 19.3 Component: `Avatar` with fallback

```tsx
// components/ui/Avatar.tsx
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

const sizeMap = {
  xs: "size-6 text-[10px]",
  sm: "size-7 text-xs",
  md: "size-8 text-sm",
  lg: "size-10 text-base",
  xl: "size-12 text-lg",
} as const;

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof sizeMap;
  status?: "online" | "away" | "busy" | "offline";
  className?: string;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
}

function colorFromName(name: string): string {
  // hash name → hue
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 70% 88%)`;
}

const statusColor = {
  online: "bg-success-500",
  away: "bg-warning-500",
  busy: "bg-error-500",
  offline: "bg-slate-400",
} as const;

export function Avatar({ name, src, size = "md", status, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        sizeMap[size], className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        className="flex size-full items-center justify-center font-semibold text-slate-700"
        style={{ backgroundColor: colorFromName(name) }}
        delayMs={200}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-surface-raised",
            size === "xs" ? "size-1.5" : "size-2.5",
            statusColor[status],
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </AvatarPrimitive.Root>
  );
}
```

### 19.4 Component: `StatusBadge`

```tsx
// components/ui/StatusBadge.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusMap = {
  new:         { label: "New",         dotVar: "--color-status-new",         bgVar: "--color-status-new-bg" },
  "in-progress":{ label: "In progress", dotVar: "--color-status-in-progress",bgVar: "--color-status-in-progress-bg" },
  "in-review": { label: "In review",   dotVar: "--color-status-in-review",  bgVar: "--color-status-in-review-bg" },
  done:        { label: "Done",        dotVar: "--color-status-done",        bgVar: "--color-status-done-bg" },
  closed:      { label: "Closed",      dotVar: "--color-status-closed",      bgVar: "--color-status-closed-bg" },
  "on-hold":   { label: "On hold",     dotVar: "--color-status-on-hold",     bgVar: "--color-status-on-hold-bg" },
  rejected:    { label: "Rejected",    dotVar: "--color-status-rejected",    bgVar: "--color-status-rejected-bg" },
} as const;

export type WPStatus = keyof typeof statusMap;

export function StatusBadge({ status, className }: { status: WPStatus; className?: string }) {
  const s = statusMap[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", className)}
      style={{
        backgroundColor: `var(${s.bgVar})`,
        color: `var(${s.dotVar})`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: `var(${s.dotVar})` }}
        aria-hidden="true"
      />
      {s.label}
    </span>
  );
}
```

### 19.5 Pattern: Inline edit with optimistic update

```tsx
// components/work-packages/table/WorkPackageInlineEdit.tsx
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";

export function useInlineEditWP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const res = await fetch(`/api/work-packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onMutate: async ({ id, field, value }) => {
      await qc.cancelQueries({ queryKey: ["work-packages"] });
      const previous = qc.getQueryData(["work-packages"]);
      qc.setQueryData(["work-packages"], (old: any) =>
        old?.map((wp: any) => (wp.id === id ? { ...wp, [field]: value } : wp))
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["work-packages"], ctx.previous);
      toast.error("Save failed", { description: "Your change was rolled back." });
    },
    onSuccess: () => {
      // brief visual flash
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["work-packages"] }),
  });
}
```

### 19.6 Pattern: Skeleton that matches table

```tsx
export function WorkPackageTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="rounded-md border border-border-subtle">
      <div className="grid grid-cols-[40px_1fr_120px_120px_40px_32px] gap-3 border-b border-border-subtle bg-slate-50 px-3 py-2">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-3" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[40px_1fr_120px_120px_40px_32px] gap-3 border-b border-border-subtle px-3 py-3 last:border-0">
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-full max-w-md" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-3" />
        </div>
      ))}
    </div>
  );
}
```

### 19.7 Pattern: Toast usage

```tsx
import { toast } from "@/components/ui/Toast";

// success
toast.success("Work package created", {
  description: "#452 Add OAuth flow",
  action: { label: "Open", onClick: () => router.push(`/projects/${id}/work-packages/452`) },
});

// error with retry
toast.error("Failed to save", {
  description: "Check your connection",
  action: { label: "Retry", onClick: () => mutation.mutate() },
  duration: Infinity,
});

// loading → resolve
const id = toast.loading("Uploading file…");
await uploadFile();
toast.dismiss(id);
toast.success("File uploaded");
```

### 19.8 Pattern: Form with react-hook-form + zod

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  identifier: z.string().regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, hyphens only"),
  parentId: z.string().optional(),
  description: z.string().max(5000).optional(),
  isPublic: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

export function NewProjectForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isPublic: false },
  });

  const onSubmit = async (data: FormData) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const { id } = await res.json();
      toast.success("Project created");
      router.push(`/projects/${id}`);
    } else {
      toast.error("Failed to create project");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          {...register("name")}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && <p id="name-error" className="text-xs text-error-600">{errors.name.message}</p>}
      </div>
      {/* … */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" isLoading={isSubmitting}>Create project</Button>
      </div>
    </form>
  );
}
```

### 19.9 Pattern: Pull-to-refresh (mobile)

```tsx
// hooks/use-pull-to-refresh.ts
import { useEffect, useRef } from "react";

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const startY = useRef(0);
  useEffect(() => {
    let pulling = false;
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        startY.current = e.touches[0]?.clientY ?? 0;
        pulling = true;
      }
    }
    async function onTouchEnd(e: TouchEvent) {
      if (!pulling) return;
      const endY = e.changedTouches[0]?.clientY ?? 0;
      if (endY - startY.current > 100) {
        await onRefresh();
      }
      pulling = false;
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh]);
}
```

### 19.10 Pattern: TanStack Query infinite list (WP table)

```ts
// hooks/use-work-packages.ts
import { useInfiniteQuery } from "@tanstack/react-query";

export function useWorkPackages(projectId: string, query: WPQuery) {
  return useInfiniteQuery({
    queryKey: ["work-packages", projectId, query],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        ...query,
        cursor: pageParam ?? "",
        limit: "100",
      });
      const res = await fetch(`/api/projects/${projectId}/work-packages?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{ items: WorkPackage[]; nextCursor: string | null }>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}
```

### 19.11 Pattern: Page header (reused everywhere)

```tsx
// components/layout/PageHeader.tsx
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-2", className)}>
      {breadcrumbs}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
```

**Usage:**

```tsx
<PageHeader
  title="Mobile App iOS"
  description="identifier: mobile-ios · 🟢 On track"
  breadcrumbs={<Breadcrumb items={[
    { label: "Projects", href: "/projects" },
    { label: "Mobile App iOS" },
  ]} />}
  actions={
    <>
      <Button variant="outline" leftIcon={<Share2 />}>Share</Button>
      <Button leftIcon={<Plus />}>New work package</Button>
    </>
  }
/>
```

### 19.12 Pattern: SSE for real-time notifications

```ts
// hooks/use-notifications-stream.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/Toast";

export function useNotificationsStream() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/sse?channel=notifications");
    es.addEventListener("notification", (e) => {
      const notif = JSON.parse((e as MessageEvent).data);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      toast(notif.title, { description: notif.body });
    });
    return () => es.close();
  }, [qc]);
}
```

### 19.13 Pattern: a11y live region for table count

```tsx
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {`Showing ${count} of ${total} work packages`}
</div>
```

### 19.14 Pattern: Skip link

```tsx
// components/layout/SkipLink.tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-tooltip focus:rounded-md focus:bg-primary-600 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}
```

### 19.15 Pattern: Print styles

```css
@media print {
  /* hide chrome */
  header, aside, .no-print, [role="navigation"] { display: none !important; }
  /* expand main */
  main { padding: 0 !important; max-width: 100% !important; }
  /* prevent breaking rows */
  tr, .card { break-inside: avoid; }
  /* ensure text is black on white */
  body { background: white !important; color: black !important; }
  /* show link URLs */
  a[href]::after { content: " (" attr(href) ")"; font-size: 0.8em; color: #666; }
}
```

### 19.16 Pattern: Density toggle (compact / comfortable)

We support two density modes via a `data-density` attribute on `<html>`:

- `comfortable` (default): row height 36px, padding `p-4`, font `text-sm`
- `compact`: row height 28px, padding `p-2`, font `text-xs`

```tsx
function applyDensity(d: "comfortable" | "compact") {
  document.documentElement.dataset.density = d;
  localStorage.setItem("openproject:density", d);
}

// in WP row
<tr className="data-[density=compact]:h-7 data-[density=comfortable]:h-9">
```

### 19.17 Pattern: Animation variants (framer-motion)

```ts
// lib/motion.ts
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};

export const slideUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] },
};

export const slideRight = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
};
```

### 19.18 Pattern: Error boundary with sentry

```tsx
// pages/_app.tsx (extend)
import * as Sentry from "@sentry/nextjs";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

<Sentry.ErrorBoundary
  fallback={<ErrorFallback />}
  showDialog
  onError={(error) => console.error(error)}
>
  <ErrorBoundary>
    <Component {...pageProps} />
  </ErrorBoundary>
</Sentry.ErrorBoundary>
```

### 19.19 Pattern: Status pill motion

```tsx
<motion.span
  key={status}  // re-mount on status change → triggers entry animation
  initial={{ scale: 0.9, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
>
  <StatusBadge status={status} />
</motion.span>
```

### 19.20 Pattern: Prose for wiki/news

```tsx
<article className="prose prose-slate max-w-none dark:prose-invert
  prose-headings:tracking-tight
  prose-h1:text-3xl prose-h1:font-bold
  prose-h2:text-2xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3
  prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2
  prose-p:leading-relaxed
  prose-a:text-primary-700 prose-a:no-underline hover:prose-a:underline
  prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
  prose-code:before:content-none prose-code:after:content-none
  prose-pre:bg-slate-900 prose-pre:text-slate-50
  prose-img:rounded-md prose-img:border prose-img:border-border-subtle
  prose-blockquote:border-l-primary-500 prose-blockquote:bg-slate-50
  prose-blockquote:py-1 prose-blockquote:not-italic
  prose-table:border prose-table:border-border-subtle
  prose-th:bg-slate-50 prose-th:p-2
  prose-td:p-2
">
  {markdown}
</article>
```

### 19.21 Pattern: Gantt bar styling

```tsx
<div
  className={cn(
    "absolute top-1 h-6 rounded-md",
    "flex items-center px-2 text-xs font-medium",
    "transition-shadow duration-fast",
    "hover:shadow-md hover:ring-2 hover:ring-primary-500/30",
    isCritical
      ? "bg-error-500 text-white"
      : isCompleted
      ? "bg-success-500 text-white"
      : "bg-primary-500 text-white"
  )}
  style={{ left: `${x}%`, width: `${w}%` }}
  role="button"
  tabIndex={0}
  aria-label={`${subject}, ${start} to ${end}, ${percentComplete}% complete`}
>
  <span className="truncate">{subject}</span>
</div>
```

### 19.22 Pattern: Empty state for a filter that returns nothing

```tsx
{filtered.length === 0 ? (
  <EmptyState
    icon={<FilterX className="size-12" />}
    title="No matches"
    description={`No work packages match your current filters. Try removing the "${activeFilterLabel}" filter.`}
    primaryAction={<Button onClick={clearFilters}>Clear all filters</Button>}
  />
) : (
  <Table data={filtered} />
)}
```

### 19.23 Pattern: Toast region (mounted once in `_app.tsx`)

```tsx
import { Toaster } from "@/components/ui/Toaster";

// in _app.tsx return:
<>
  <QueryClientProvider>...</QueryClientProvider>
  <Toaster position="bottom-right" richColors closeButton />
</>
```

```tsx
// components/ui/Toaster.tsx
import { Toaster as SonnerToaster } from "sonner";

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  const { theme } = useTheme();
  return (
    <SonnerToaster
      theme={theme === "system" ? undefined : theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-surface-raised group-[.toaster]:text-text-default group-[.toaster]:border-border-subtle group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-text-muted",
          actionButton: "group-[.toast]:bg-primary-600 group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-slate-100 group-[.toast]:text-text-default",
        },
      }}
      {...props}
    />
  );
}
```

### 19.24 Pattern: Empty state for new account

```tsx
<EmptyState
  icon={<Rocket className="size-12 text-primary-500" />}
  title="Welcome to OpenProject"
  description="You don't have any projects yet. Create your first project to start tracking work, or join one with an invite link."
  primaryAction={<Button leftIcon={<Plus />} onClick={createFirst}>Create your first project</Button>}
  secondaryAction={<Button variant="outline">Check your invite</Button>}
  learnMoreLink="/help/getting-started"
/>
```

### 19.25 Pattern: Z-index naming map

```ts
// lib/z-index.ts (consumed via Tailwind utilities, just for reference)
export const z = {
  base: 0,
  raised: 10,        // sticky table header
  sticky: 20,        // topbar
  drawer: 30,        // side drawer
  dropdown: 40,      // popovers, menus
  modal: 50,         // scrim
  modalContent: 51,  // dialog
  toast: 60,         // notifications
  tooltip: 70,       // always on top
} as const;
```

### 19.26 Pattern: Skipping the page transition on sub-tab

```tsx
const isTopLevel = router.pathname.split("/").length <= 2;

// AnimatePresence key uses pathname (full) — sub-tab changes still re-render
// but transitions are off when isTopLevel is false
<AnimatePresence mode="wait" initial={false}>
  {isTopLevel ? (
    <motion.div key={router.asPath} {...fadeIn}>
      <Component {...pageProps} />
    </motion.div>
  ) : (
    <Component key={router.asPath} {...pageProps} />
  )}
</AnimatePresence>
```

### 19.27 Pattern: Density-aware table cell

```tsx
<td className="px-3 py-2 data-[density=compact]:py-1 text-sm group-data-[density=compact]:text-xs">
  {value}
</td>
```

### 19.28 Pattern: 2FA setup wizard (extending existing)

```tsx
<Modal open={open} onOpenChange={setOpen}>
  <ModalContent size="md">
    <ModalHeader>
      <ModalTitle>Set up two-factor authentication</ModalTitle>
      <ModalDescription>Scan this QR code with your authenticator app.</ModalDescription>
    </ModalHeader>
    <div className="space-y-4">
      <div className="flex justify-center rounded-md border border-border-subtle p-4">
        <QRCode value={otpauthUrl} size={192} />
      </div>
      <Alert>
        <Info className="size-4" />
        <AlertTitle>Can't scan?</AlertTitle>
        <AlertDescription>Enter this code manually: <code className="font-mono">{secret}</code></AlertDescription>
      </Alert>
      <div className="space-y-1.5">
        <Label htmlFor="code">Verification code</Label>
        <Input id="code" inputMode="numeric" maxLength={6} placeholder="123456" autoComplete="one-time-code" />
      </div>
    </div>
    <ModalFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={verify}>Verify and enable</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

### 19.29 Pattern: Notification bell popover

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" aria-label={`Notifications (${unreadCount} unread)`} className="relative">
      <Bell className="size-4" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-error-600 text-[10px] font-semibold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-96 p-0">
    <NotificationCenter />
  </PopoverContent>
</Popover>
```

### 19.30 Pattern: Gantt row label virtualization

For large Gantts, use TanStack Virtual to render only visible rows:

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function GanttRows({ rows }: { rows: GanttRow[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });
  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((v) => (
          <div
            key={v.key}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: v.size, transform: `translateY(${v.start}px)` }}
          >
            <GanttRow row={rows[v.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## End of Document

This document is the canonical reference for v2 of the OpenProject Rewrite UI/UX system. It is intended to be read cover-to-cover by new engineers and used as a lookup by experienced ones. All code samples are illustrative — actual implementation may differ slightly based on engineering constraints discovered during build.

**For follow-up questions, see:**
- `02-architecture.md` — system architecture
- `03-implementation-roadmap.md` — phased build plan
- `04-component-api-reference.md` — full component API spec (to be written)
- `05-a11y-checklist.md` — per-page a11y test plan (to be written)
- `06-design-tokens.json` — exportable tokens for Figma (to be written)

**Sign-off required from:** Design Lead, Frontend Lead, Head of Product, Accessibility Lead.

---
name: openproject-phase2-work-packages
description: Implements Phase 2 work package views (Table, Gantt, Board, Calendar). Use when working on Phase 2 tasks — any work package view, query management, or activity feed.
---

# OpenProject Phase 2: Work Package Views

## Overview

Phase 2 implements all work package view modes: Table, Gantt, Board, and Calendar. This is the most complex phase technically, featuring drag-and-drop, virtual scrolling, and complex state management.

## Current Status (as of 2026-05-08)

### Test Suite: ✅ ALL PASSING
```
Test Files  14 passed (14)
Tests       329 passed | 1 skipped (330)
Duration    ~20s
```

### Test Coverage by View

| View | Test File | Tests | Coverage |
|------|-----------|-------|---------|
| Table | `__tests__/components/work-packages-table.test.tsx` | 57 | Skeleton, EmptyState, Header, Row, Filters, BulkActions, InlineEdit |
| Gantt | `__tests__/components/work-packages-gantt.test.tsx` | 47 | Bar, Timeline, Rows, ZoomControls, TodayLine, DependencyLines, Skeleton, EmptyState |
| Calendar | `__tests__/components/work-packages-calendar.test.tsx` | 28 | Header, Grid, Skeleton, EmptyState, integration |
| Board | `__tests__/components/work-packages-board.test.tsx` | 26 | Skeleton, EmptyState, WIP limit, column actions |
| Page | `__tests__/components/work-packages-page.test.tsx` | 14 | View switcher, modal, URL routing, SaveQueryDialog |
| Hooks | `__tests__/hooks/use-hooks.test.tsx` | 40 | useWipLimits, useProjects, useWorkPackages, mutations, relations |
| Error Handling | `__tests__/components/error-handling.test.tsx` | 16 | ErrorBoundary, mutation retry, view error states, responsive CSS |
| Gantt lib | `__tests__/lib/gantt-calculate.test.ts` | 45 | Unit tests for date/timeline calculations |

### Completed Tasks (p2-xxx)

| Task | Description | Status |
|------|-------------|--------|
| p2-011 | Table View skeleton + empty state | ✅ Code + ✅ Tests |
| p2-012 | Table View row rendering | ✅ Code + ✅ Tests |
| p2-013 | Table View column sorting | ✅ Code + ✅ Tests |
| p2-014 | Table View filters | ✅ Code + ✅ Tests |
| p2-015 | Table View bulk actions | ✅ Code + ✅ Tests |
| p2-016 | Gantt View timeline rendering | ✅ Code + ✅ Tests |
| p2-017 | Gantt View bar rendering | ✅ Code + ✅ Tests |
| p2-018 | Gantt View zoom controls | ✅ Code + ✅ Tests |
| p2-019–022 | Board View WIP limit + skeleton + empty state | ✅ Code + ✅ Tests |
| p2-023 | Calendar View skeleton | ✅ Code + ✅ Tests |
| p2-024 | Calendar View empty state | ✅ Code + ✅ Tests |
| p2-025 | Calendar View grid rendering | ✅ Code + ✅ Tests |
| p2-030 | Hook tests — useWipLimits, useProjects | ✅ Tests |
| p2-031 | Hook tests — useWorkPackages + mutations | ✅ Tests |
| p2-032 | View switcher tabs integration | ✅ Code + ✅ Tests |
| p2-033 | Error handling + retry + responsive | ✅ Tests |
| p2-034 | Final verification — all tests pass | ✅ |

### Remaining Tasks

| Task | Description | Priority |
|------|-------------|----------|
| p2-026 | Bulk edit work packages | High |
| p2-027 | Board drag-and-drop between columns | High |
| p2-028 | Project sidebar navigation | Medium |
| p2-029 | Search bar integration | Medium |
| p2-035+ | Remaining Phase 2 tasks | Low |

## When to Use

- Building any work package view (Table, Gantt, Board, Calendar)
- Implementing query management (save/load filters)
- Adding work package detail page with activity feed
- Any drag-and-drop functionality

## Prerequisites

Before starting Phase 2 implementation:
- Phase 1 foundation must be complete
- TanStack Query hooks exist in `hooks/use-work-packages.ts`
- Zustand store exists in `stores/ui-store.ts`
- @tanstack/react-virtual installed for virtual scrolling
- date-fns installed for date manipulation

## Process

### Step 1: Read the Spec

Read the full Phase 2 spec:
```
/home/cwlai/wiki/concepts/openproject-rewrite-phase2-spec.md
```

### Step 2: Identify the View to Build

Phase 2 has 4 main views:

| View | Key Technical Challenges |
|------|--------------------------|
| Table | Virtual scrolling, inline edit, filters |
| Gantt | Timeline rendering, dependencies, drag-to-resize |
| Board | Kanban drag-and-drop, status columns |
| Calendar | Month/week grid, event positioning |

### Step 3: Build Vertically

Build one complete path at a time:

```
Task 1: Table View - Query loading + basic table display
Task 2: Table View - Column sorting + filters
Task 3: Table View - Inline edit
Task 4: Board View - Status columns layout
Task 5: Board View - Drag-and-drop between columns
Task 6: Gantt View - Timeline rendering
Task 7: Gantt View - Dependencies
Task 8: Calendar View - Month grid
Task 9: Calendar View - Week view
Task 10: Query Management - Save/load
```

### Step 4: Key Patterns

#### TanStack Query Usage
```typescript
// hooks/use-work-packages.ts — returns { workPackages: { data, isLoading, isError } }
const { workPackages: { data, isLoading, isError } } = useWorkPackages(queryParams);
```

#### Zustand Store
```typescript
// stores/ui-store.ts handles:
// - Active view mode (table/gantt/board/calendar)
// - Selected work package
// - Filter state
```

#### @dnd-kit for Board
```typescript
// Board drag-and-drop uses @dnd-kit
// Pattern: useSensors, useDraggable, useDroppable
// On drop: call API → updateOptimistic → invalidate query
```

### Step 5: Verification

For each view implementation:

1. Run unit tests: `npm test -- --run`
2. Run `npm run build` to verify compilation
3. Run `npx tsc --noEmit` for type safety (note: some pre-existing TS warnings in test mocks are OK)
4. Manual testing in browser

## Common Issues

### Board Drag Not Saving
Ensure `onDragEnd` calls the mutation and handles optimistic updates:
```typescript
onMutate: async (newStatus) => {
  await queryClient.cancelQueries({ queryKey: ['workPackages'] });
  const previous = queryClient.getQueryData(['workPackages']);
  queryClient.setQueryData(['workPackages'], (old) => /* optimistic update */);
  return { previous };
},
onError: (err, newStatus, context) => {
  queryClient.setQueryData(['workPackages'], context.previous);
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['workPackages'] });
},
```

### Gantt Timeline Rendering
- Use CSS Grid for timeline layout
- Calculate positions based on startDate/dueDate
- Handle overflow with horizontal scroll

### Testing Patterns

**Component tests**: Use `mockComponents` from `__tests__/lib/test-utils.tsx` to mock heavy deps (router, icons, next/navigation). Import actual components directly — do NOT mock them.

**Hook tests**: Use `QueryClient` with `retry: false`. Mock `globalThis.fetch` with `vi.spyOn(globalThis, 'fetch').mockRejectedValue()` for error cases. Use `waitFor` with `{ timeout: 3000 }` for async state.

**ErrorBoundary tests**: React error recovery is complex in tests — prefer testing: (a) error message renders, (b) onError callback is called, (c) Try again button exists.

**Hidden elements**: Use `queryByTestId` (returns null) instead of `getByTestId` (throws) for CSS-hidden elements (`display: none`).

## Files to Create/Modify

| View | New Files | Modify Files |
|------|-----------|-------------|
| Table | `components/work-packages/table/*.tsx` | `pages/projects/[projectId]/work-packages/index.tsx` |
| Gantt | `components/work-packages/gantt/*.tsx` | `pages/projects/[projectId]/work-packages/index.tsx` |
| Board | `components/work-packages/board/*.tsx` | `pages/projects/[projectId]/work-packages/index.tsx` |
| Calendar | `components/work-packages/calendar/*.tsx` | `pages/projects/[projectId]/work-packages/index.tsx` |
| Detail | `pages/projects/[projectId]/work-packages/[id].tsx` | `hooks/use-work-packages.ts` |

## Dependencies to Install

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @tanstack/react-virtual  # for virtual scrolling
npm install date-fns  # for date manipulation
```

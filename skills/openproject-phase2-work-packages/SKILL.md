---
name: openproject-phase2-work-packages
description: Implements Phase 2 work package views (Table, Gantt, Board, Calendar). Use when working on Phase 2 tasks — any work package view, query management, or activity feed.
---

# OpenProject Phase 2: Work Package Views

## Overview

Phase 2 implements all work package view modes: Table, Gantt, Board, and Calendar. This is the most complex phase technically, featuring drag-and-drop, virtual scrolling, and complex state management.

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
- @dnd-kit should be available for drag-and-drop

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
// hooks/use-work-packages.ts already exists
// Use for all data fetching
const { data, isLoading } = useWorkPackages(queryParams);
```

#### Zustand Store
```typescript
// stores/ui-store.ts handles:
// - Active view mode (table/gantt/board/calendar)
// - Selected work package
// - Filter state
```

#### DnD Kit for Board
```typescript
// Board drag-and-drop uses @dnd-kit
// Pattern: useSensors, useDraggable, useDroppable
// On drop: call API → updateOptimistic → invalidate query
```

### Step 5: Verification

For each view implementation:

1. Run unit tests
2. Run `npm run build` to verify compilation
3. Run `npx tsc --noEmit` for type safety
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

## Files to Create/Modify

| View | New Files | Modify Files |
|------|-----------|-------------|
| Table | `components/work-packages/Table.tsx` | `pages/projects/[projectId]/work-packages/index.tsx` |
| Gantt | `components/work-packages/Gantt.tsx` | `pages/projects/[projectId]/work-packages/index.tsx` |
| Board | `components/work-packages/Board.tsx` | `pages/projects/[projectId]/work-packages/index.tsx` |
| Calendar | `components/work-packages/Calendar.tsx` | `pages/projects/[projectId]/work-packages/index.tsx` |
| Detail | `pages/projects/[projectId]/work-packages/[id].tsx` | `hooks/use-work-packages.ts` |

## Dependencies to Install

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @tanstack/react-virtual  # for virtual scrolling
npm install date-fns  # for date manipulation
```

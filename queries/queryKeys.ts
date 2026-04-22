import type { WorkPackageFilter } from '../types'

/**
 * TanStack Query key factories for all work-package and query-related data.
 * Centralized here so hook authors import from one place.
 */
export const queryKeys = {
  /** All work packages (list), optionally filtered */
  workPackages: (filters?: WorkPackageFilter) =>
    ['work-packages', filters ?? null] as const,

  /** Single work package by id */
  workPackage: (id: string) => ['work-packages', id] as const,

  /** Activities/comments on a work package */
  workPackageActivities: (id: string) =>
    ['work-packages', id, 'activities'] as const,

  /** Relations for a work package */
  workPackageRelations: (id: string) =>
    ['work-packages', id, 'relations'] as const,

  /** All saved queries, optionally scoped to project */
  queries: (projectId?: string) => ['queries', projectId ?? null] as const,

  /** Single saved query by id */
  query: (id: string) => ['queries', id] as const,

  /** All statuses */
  statuses: () => ['statuses'] as const,

  /** All types */
  types: () => ['types'] as const,

  /** All priorities */
  priorities: () => ['priorities'] as const,

  /** All users (for a project or global) */
  users: (projectId?: string) => ['users', projectId ?? null] as const,
} as const

export type QueryKeys = typeof queryKeys

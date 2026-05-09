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

  /** WIP limits for a project */
  wipLimits: (projectId: string) => ['projects', projectId, 'wip-limits'] as const,

  /** All wiki pages for a project */
  wikiPages: (projectId: string) => ['wiki-pages', projectId] as const,

  /** Single wiki page by slug */
  wikiPage: (slug: string) => ['wiki-pages', slug] as const,

  /** All forums for a project */
  forums: (projectId: string) => ['forums', projectId] as const,

  /** Single forum by id */
  forum: (id: string) => ['forums', 'detail', id] as const,

  /** Single forum thread by id */
  forumThread: (id: string) => ['forum-threads', id] as const,

  /** All threads for a forum */
  forumThreads: (forumId: string) => ['forum-threads', 'by-forum', forumId] as const,

  /** All posts for a thread */
  forumPosts: (threadId: string) => ['forum-posts', 'by-thread', threadId] as const,

  // ─── Documents ────────────────────────────────────────────────────────────

  /** Folder contents (folders + documents) for a project at a given parent folder */
  documentFolders: (projectId: string, parentId?: string | null) =>
    ['document-folders', projectId, parentId ?? null] as const,

  /** Breadcrumb trail for a folder */
  documentFolderBreadcrumb: (folderId: string) =>
    ['document-folders', 'breadcrumb', folderId] as const,

  /** All documents for a project */
  documents: (projectId: string) => ['documents', projectId] as const,

  /** Single document by id */
  document: (id: string) => ['documents', 'detail', id] as const,

  // ─── Meetings ──────────────────────────────────────────────────────────────

  /** All meetings for a project, optionally filtered by date range */
  meetings: (
    projectId: string,
    options?: { startAfter?: string; endBefore?: string }
  ) => ['meetings', projectId, options ?? null] as const,

  /** Single meeting by id */
  meeting: (id: string) => ['meetings', 'detail', id] as const,
} as const

export type QueryKeys = typeof queryKeys

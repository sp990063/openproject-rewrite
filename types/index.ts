export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  isSystemAdmin: boolean
  passwordMigrationRequired: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  name: string
  description?: string | null
  identifier: string
  status: 'active' | 'archived' | 'on_hold'
  createdAt: Date
  updatedAt: Date
  members?: Member[]
  workPackages?: WorkPackage[]
  versions?: Version[]
  modules?: ProjectModule[]
}

export interface Member {
  id: string
  userId: string
  projectId: string
  roleId: string
  createdAt: Date
  user?: User
  project?: Project
  role?: Role
}

export interface Role {
  id: string
  name: string
  permissions: string[]
}

export interface WorkPackage {
  id: string
  projectId: string
  subject: string
  description?: string | null
  statusId: string
  typeId: string
  priorityId: string
  assigneeId?: string | null
  authorId: string
  startDate?: Date | null
  dueDate?: Date | null
  estimatedHours?: number | null
  position: number
  parentId?: string | null
  createdAt: Date
  updatedAt: Date
  project?: Project
  status?: Status
  type?: Type
  priority?: Priority
  assignee?: User | null
  author?: User
  parent?: WorkPackage | null
  children?: WorkPackage[]
}

export interface Status {
  id: string
  name: string
  color: string
  position: number
  isClosed: boolean
}

export interface Type {
  id: string
  name: string
  color: string
  position: number
  isMilestone: boolean
}

export interface Priority {
  id: string
  name: string
  color: string
  position: number
}

export interface WorkPackageRelation {
  id: string
  fromId: string
  toId: string
  relationType: 'blocks' | 'blocked_by' | 'precedes' | 'follows' | 'relates'
}

export interface TimeEntry {
  id: string
  workPackageId: string
  userId: string
  hours: number
  comment?: string | null
  spentOn: Date
  userTimezone: string
  status: 'pending' | 'submitted' | 'approved' | 'rejected'
  approvedBy?: string | null
  approvedAt?: Date | null
  rejectReason?: string | null
  deletedAt?: Date | null
  deletedBy?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Activity {
  id: string
  workPackageId: string
  userId: string
  user?: { id: string; name: string; email: string; avatarUrl: string | null }
  action: 'created' | 'updated' | 'commented'
  comment?: string | null  // rendered comment text
  details?: Record<string, unknown> | null
  createdAt: Date
}

export interface Relation {
  id: string
  sourceWorkPackageId: string
  targetWorkPackageId: string
  type: string
  targetWorkPackage?: {
    id: string
    subject: string
    type?: { id: string; name: string; color: string }
    status?: { id: string; name: string; color: string }
  } | null
  createdAt: Date
}

export interface Version {
  id: string
  projectId: string
  name: string
  status: 'open' | 'closed'
  dueDate?: Date | null
}

export interface ProjectModule {
  id: string
  projectId: string
  module: string
  enabled: boolean
}

// ─── Phase 2: Extended Types ────────────────────────────────────────────────

/** Filter params for work package list queries */
export interface WorkPackageFilter {
  statusId?: string[]
  typeId?: string[]
  assigneeId?: string[]
  priorityId?: string[]
  startDate?: { gte?: string; lte?: string }
  dueDate?: { gte?: string; lte?: string }
  search?: string
  projectId?: string
}

/** Work package with Gantt-specific computed fields */
export interface GanttWorkPackage extends WorkPackage {
  ganttStartDate: Date
  ganttEndDate: Date
  ganttLeft: number   // pixels from timeline origin
  ganttWidth: number   // pixels (estimatedHours-based or day-based)
}

/** Board column (grouped by status) */
export interface BoardColumn {
  statusId: string
  status: Status
  limit?: number
  workPackages: WorkPackage[]
  isOverLimit: boolean
  isAtLimit: boolean
}

/** Calendar event (work package as a day/week cell event) */
export interface CalendarEvent {
  id: string
  workPackageId: string
  subject: string
  startDate: Date
  endDate: Date
  type: Type
  status: Status
  isMilestone: boolean
  row: number   // which row within the day column
  col: number   // which day column (0 = first day of range)
}

/** Saved query (user-defined filter + sort + group state) */
export interface Query {
  id: string
  userId: string
  projectId?: string | null
  name: string
  filters: WorkPackageFilter
  sortBy: SortBy[]
  groupBy?: string | null
  displayMode: 'table' | 'gantt' | 'board' | 'calendar'
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export type SortBy = [string, 'asc' | 'desc']

/** Per-status WIP limit for a project board */
export interface ProjectWipLimit {
  id: string
  projectId: string
  statusId: string
  limit: number | null
}

// ─── Phase 4: Wiki Types ────────────────────────────────────────────────────

export interface WikiPage {
  id: string
  projectId: string
  title: string
  slug: string
  content: string
  parentId: string | null
  authorId: string
  version: number
  createdAt: Date
  updatedAt: Date
  project?: Project
  author?: { id: string; name: string; email: string; avatarUrl: string | null }
  parent?: WikiPage | null
  children?: WikiPage[]
  versions?: WikiPageVersion[]
}

export interface WikiPageVersion {
  id: string
  wikiPageId: string
  content: string
  authorId: string
  version: number
  createdAt: Date
  author?: { id: string; name: string; email: string; avatarUrl: string | null }
}

// ─── Phase 4: Forum Types (re-exported from forum.ts) ───────────────────────

export type { Forum, ForumThread, ForumPost, CreateForumInput, UpdateForumInput, CreateThreadInput, UpdateThreadInput, CreatePostInput, UpdatePostInput } from './forum'

// ─── Phase 4: Document Types ─────────────────────────────────────────────────

export type { ProjectDocument, ProjectDocumentFolder, CreateDocumentInput, UpdateDocumentInput, CreateFolderInput, UpdateFolderInput } from './document'

// ─── Global Search Types ──────────────────────────────────────────────────────

export type { SearchResult, SearchResultType, SearchResponse, SearchFilters, SearchParams } from './search'

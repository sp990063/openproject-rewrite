// ============================================
// PROJECT TYPES (Phase 3)
// ============================================

export type ProjectStatus = 'active' | 'archived' | 'on_hold'

export type ModuleType =
  | 'work_packages'
  | 'gantt'
  | 'board'
  | 'calendar'
  | 'wiki'
  | 'forums'
  | 'documents'
  | 'meetings'
  | 'time_tracking'

export interface ProjectMember {
  id: string
  userId: string
  projectId: string
  roleId: string
  createdAt: Date
  user?: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  role?: Role
}

export interface ProjectModule {
  id: string
  projectId: string
  module: ModuleType
  enabled: boolean
}

export interface Project {
  id: string
  name: string
  description: string | null
  identifier: string
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
}

export interface ProjectDetail extends Project {
  members: ProjectMember[]
  versions: Version[]
  modules: ProjectModule[]
}

export interface Role {
  id: string
  name: string
  permissions: string[]
}

// Re-export Version for convenience
export interface Version {
  id: string
  projectId: string
  name: string
  status: 'open' | 'closed'
  dueDate: Date | null
}

// ─── API Request/Response Types ───────────────────────────────────────────────

export interface CreateProjectInput {
  name: string
  description?: string
  identifier: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  status?: ProjectStatus
}

export interface AddMemberInput {
  userId: string
  roleId: string
}

export interface UpdateMemberInput {
  roleId: string
}

export interface UpdateModulesInput {
  modules: Array<{
    module: ModuleType
    enabled: boolean
  }>
}

// ─── API Response Types ────────────────────────────────────────────────────────

export interface ProjectWithDetails extends Project {
  members: ProjectMember[]
  versions: Version[]
  modules: ProjectModule[]
  _count?: {
    members: number
    workPackages: number
  }
}

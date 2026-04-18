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
  action: 'created' | 'updated' | 'commented'
  details?: Record<string, unknown> | null
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

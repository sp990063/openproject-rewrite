import type { Status } from '@/types'

export interface BoardColumn {
  statusId: string
  status: Status
  workPackages: import('@/types').WorkPackage[]
  wipLimit: number | null // null = unlimited
  isOverLimit: boolean // computed: workPackages.length > wipLimit
  isAtLimit: boolean   // computed: workPackages.length === wipLimit
}

export interface WipLimitConfig {
  projectId: string
  statusId: string
  limit: number | null // null = no limit
}

export type { Status }

import React from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import type { Project } from '@/types/project'

interface ProjectCardProps {
  project: Project & {
    _count?: {
      members: number
      workPackages: number
    }
  }
  onClick?: () => void
}

const STATUS_VARIANT: Record<Project['status'], 'success' | 'warning' | 'danger'> = {
  active: 'success',
  on_hold: 'warning',
  archived: 'danger',
}

const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'Active',
  on_hold: 'On Hold',
  archived: 'Archived',
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/projects/${project.id}`}
            className="text-lg font-semibold text-gray-900 hover:text-blue-600 truncate block"
            onClick={(e) => e.stopPropagation()}
          >
            {project.name}
          </Link>
          <p className="text-sm text-gray-500 mt-0.5">{project.identifier}</p>
        </div>
        <Badge variant={STATUS_VARIANT[project.status]}>
          {STATUS_LABEL[project.status]}
        </Badge>
      </div>

      {project.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <span>{project._count?.members ?? 0} members</span>
        </div>
        <div className="flex items-center gap-1">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          <span>{project._count?.workPackages ?? 0} work packages</span>
        </div>
      </div>
    </div>
  )
}
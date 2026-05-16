import React from 'react'
import type { Project } from '@/types'

interface ProjectStatusWidgetProps {
  projects: Project[]
  isLoading?: boolean
}

export function ProjectStatusWidget({ projects, isLoading }: ProjectStatusWidgetProps) {
  // Count projects by status
  const statusCounts = projects.reduce((acc, project) => {
    acc[project.status] = (acc[project.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const statusColors: Record<string, string> = {
    active: 'bg-green-500',
    archived: 'bg-gray-400',
    on_hold: 'bg-yellow-500',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h2>
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No projects</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${statusColors[status] || 'bg-gray-400'}`} />
                <span className="text-sm text-gray-600 capitalize">
                  {status.replace('_', ' ')}: {count}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Total: {projects.length} projects</span>
          </div>
        </>
      )}
    </div>
  )
}

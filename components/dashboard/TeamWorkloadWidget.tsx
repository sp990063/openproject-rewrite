import React from 'react'
import type { WorkPackage } from '@/types'

interface TeamWorkloadWidgetProps {
  workPackages: WorkPackage[]
  isLoading?: boolean
}

export function TeamWorkloadWidget({ workPackages, isLoading }: TeamWorkloadWidgetProps) {
  // Group work packages by assignee
  const workloadByAssignee = workPackages.reduce((acc, wp) => {
    const assigneeName = wp.assignee?.name || wp.assignee?.login || 'Unassigned'
    acc[assigneeName] = (acc[assigneeName] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sortedAssignees = Object.entries(workloadByAssignee)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const maxCount = sortedAssignees.length > 0 ? sortedAssignees[0][1] : 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Workload</h2>
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : sortedAssignees.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No work packages</div>
      ) : (
        <div className="space-y-3">
          {sortedAssignees.map(([assignee, count]) => (
            <div key={assignee} className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-32 truncate">{assignee}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

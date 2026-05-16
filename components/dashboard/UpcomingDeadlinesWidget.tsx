import React from 'react'
import type { WorkPackage } from '@/types'

interface UpcomingDeadlinesWidgetProps {
  workPackages: WorkPackage[]
  isLoading?: boolean
}

export function UpcomingDeadlinesWidget({ workPackages, isLoading }: UpcomingDeadlinesWidgetProps) {
  // Filter work packages due within 7 days
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const upcomingDeadlines = workPackages
    .filter((wp) => {
      if (!wp.dueDate) return false
      const dueDate = new Date(wp.dueDate)
      return dueDate >= now && dueDate <= sevenDaysFromNow
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5)

  const isDueSoon = (dueDate: string) => {
    const due = new Date(dueDate)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    return due <= tomorrow
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h2>
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : upcomingDeadlines.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No deadlines in the next 7 days</div>
      ) : (
        <div className="space-y-3">
          {upcomingDeadlines.map((wp) => (
            <div key={wp.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-gray-900">{wp.subject}</p>
                <p className="text-sm text-gray-500">
                  {wp.project?.name} • {wp.type?.name}
                </p>
              </div>
              <span className={`text-sm ${isDueSoon(wp.dueDate!) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {new Date(wp.dueDate!).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

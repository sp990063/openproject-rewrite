export const dynamic = 'force-dynamic'

import React from 'react'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { useProjects } from '@/hooks/use-projects'
import { useWorkPackages } from '@/hooks/use-work-packages'
import { ProjectStatusWidget } from '@/components/dashboard/ProjectStatusWidget'
import { UpcomingDeadlinesWidget } from '@/components/dashboard/UpcomingDeadlinesWidget'
import { TeamWorkloadWidget } from '@/components/dashboard/TeamWorkloadWidget'

export default function GlobalDashboardPage() {
  const { projects } = useProjects()
  const { workPackages } = useWorkPackages()

  // Recent activity: work packages sorted by updatedAt
  const recentActivity = workPackages.data
    ?.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10) || []

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Global Dashboard</h1>
          <p className="text-gray-500 mt-1">Cross-project overview and activity</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Project Status Overview */}
          <ProjectStatusWidget projects={projects.data || []} isLoading={projects.isLoading} />

          {/* Upcoming Deadlines */}
          <UpcomingDeadlinesWidget workPackages={workPackages.data || []} isLoading={workPackages.isLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Team Workload */}
          <TeamWorkloadWidget workPackages={workPackages.data || []} isLoading={workPackages.isLoading} />

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            {workPackages.isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((wp) => (
                  <div key={wp.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{wp.subject}</p>
                      <p className="text-sm text-gray-500">
                        {wp.project?.name} • {wp.type?.name}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(wp.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

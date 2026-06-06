import React from 'react'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/shell'
import { useProjects } from '@/hooks/use-projects'
import { useWorkPackages } from '@/hooks/use-work-packages'
import { Badge } from '@/components/ui'
import Link from 'next/link'

function DashboardContent() {
  const { data: session } = useSession()
  const { projects } = useProjects()
  const { workPackages } = useWorkPackages()

  // Get recent work packages
  const recentWorkPackages = workPackages.data?.slice(0, 5) || []

  return (
    <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {session?.user?.name || 'User'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
              <Link href="/projects" className="text-sm text-blue-600 hover:text-blue-500">
                View all
              </Link>
            </div>
            {projects.isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : projects.data && projects.data.length > 0 ? (
              <div className="space-y-3">
                {projects.data.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{project.name}</h3>
                        <p className="text-sm text-gray-500">{project.identifier}</p>
                      </div>
                      <Badge
                        variant={
                          project.status === 'active'
                            ? 'success'
                            : project.status === 'archived'
                            ? 'default'
                            : 'warning'
                        }
                      >
                        {project.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No projects yet.{' '}
                <Link href="/projects" className="text-blue-600 hover:text-blue-500">
                  Create one
                </Link>
              </div>
            )}
          </div>

          {/* Recent Work Packages */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Work Packages</h2>
            </div>
            {workPackages.isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : recentWorkPackages.length > 0 ? (
              <div className="space-y-3">
                {recentWorkPackages.map((wp) => (
                  <div key={wp.id} className="p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{wp.subject}</h3>
                        <p className="text-sm text-gray-500">
                          {wp.project?.name} • {wp.type?.name}
                        </p>
                      </div>
                      <Badge variant={wp.status?.isClosed ? 'default' : 'info'}>
                        {wp.status?.name}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No work packages yet.
              </div>
            )}
          </div>
        </div>
      </div>
  )
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  )
}

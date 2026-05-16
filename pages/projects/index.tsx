export const dynamic = 'force-dynamic'
import React from 'react'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { useProjects } from '@/hooks/use-projects'
import { Button, Badge } from '@/components/ui'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function ProjectsPage() {
  const { projects } = useProjects()
  const router = useRouter()

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'archived':
        return 'default'
      case 'on_hold':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <Button variant="primary" onClick={() => router.push('/projects/new')}>
            New Project
          </Button>
        </div>

        {projects.isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading projects...</div>
        ) : projects.data && projects.data.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Identifier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Packages
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.data.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-blue-600 hover:text-blue-500 font-medium"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {project.identifier}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getStatusVariant(project.status)}>
                        {project.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {project.members?.length || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {'_count' in project && typeof project._count === 'object' && project._count !== null
                        ? (project._count as { workPackages?: number })?.workPackages ?? 0
                        : 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/projects/${project.id}/work-packages`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-4">No projects yet</p>
            <Button variant="primary" onClick={() => router.push('/projects/new')}>
              Create your first project
            </Button>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  )
}

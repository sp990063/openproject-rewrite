import React from 'react'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { useProjects } from '@/hooks/use-projects'
import { Badge } from '@/components/ui'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function ProjectOverviewPage() {
  const router = useRouter()
  const { projectId } = router.query
  const { projects } = useProjects()

  const project = projects.data?.find((p) => p.id === projectId)

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (projects.isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading project...</div>
      </AuthenticatedLayout>
    )
  }

  if (!project) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Project not found</p>
          <Link href="/projects" className="text-blue-600 hover:text-blue-500">
            Back to projects
          </Link>
        </div>
      </AuthenticatedLayout>
    )
  }

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
        <div className="mb-6">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Projects
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-500 mt-1">{project.identifier}</p>
            </div>
            <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
          </div>

          {project.description && (
            <p className="text-gray-600 mt-4">{project.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href={`/projects/${projectId}/work-packages`}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Work Packages</h3>
            <p className="text-3xl font-bold text-blue-600">
              {(project as Record<string, unknown>)._count &&
                ((project as Record<string, { _count: { workPackages: number } }>)._count?.workPackages || 0)}
            </p>
            <p className="text-gray-500 text-sm mt-1">View and manage tasks</p>
          </Link>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Members</h3>
            <p className="text-3xl font-bold text-green-600">{project.members?.length || 0}</p>
            <p className="text-gray-500 text-sm mt-1">Team members</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Versions</h3>
            <p className="text-3xl font-bold text-purple-600">{project.versions?.length || 0}</p>
            <p className="text-gray-500 text-sm mt-1">Active versions</p>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

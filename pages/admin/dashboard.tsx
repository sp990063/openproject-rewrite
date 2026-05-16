export const dynamic = 'force-dynamic'

import React from 'react'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { useProjects } from '@/hooks/use-projects'
import { useWorkPackages } from '@/hooks/use-work-packages'
import { useMembers } from '@/hooks/useMembers'

export default function AdminDashboardPage() {
  const projects = useProjects()
  const workPackages = useWorkPackages()
  const members = useMembers()

  // Calculate stats
  const stats = {
    totalProjects: projects.data?.length || 0,
    activeProjects: projects.data?.filter(p => p.status === 'active').length || 0,
    totalWorkPackages: workPackages.data?.length || 0,
    openWorkPackages: workPackages.data?.filter(wp => !wp.status?.isClosed).length || 0,
    totalMembers: members.data?.length || 0,
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">System-wide statistics and overview</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-500 mb-1">Total Projects</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalProjects}</p>
            <p className="text-sm text-green-600 mt-1">{stats.activeProjects} active</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-500 mb-1">Work Packages</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalWorkPackages}</p>
            <p className="text-sm text-blue-600 mt-1">{stats.openWorkPackages} open</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-500 mb-1">Team Members</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalMembers}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-500 mb-1">Completion Rate</p>
            <p className="text-3xl font-bold text-gray-900">
              {stats.totalWorkPackages > 0
                ? Math.round(((stats.totalWorkPackages - stats.openWorkPackages) / stats.totalWorkPackages) * 100)
                : 0}%
            </p>
          </div>
        </div>

        {/* Quick Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Projects by Status</h2>
            {projects.isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-3">
                {['active', 'archived', 'on_hold'].map((status) => {
                  const count = projects.data?.filter(p => p.status === status).length || 0
                  return (
                    <div key={status} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-gray-700 capitalize">{status.replace('_', ' ')}</span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Work Package Summary</h2>
            {workPackages.isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Open', count: stats.openWorkPackages, color: 'text-blue-600' },
                  { label: 'Closed', count: stats.totalWorkPackages - stats.openWorkPackages, color: 'text-green-600' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700">{label}</span>
                    <span className={`font-medium ${color}`}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

export const dynamic = 'force-dynamic'

import React from 'react'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useNotifications } from '@/hooks/useNotifications'
import { useMyWorkPackages } from '@/hooks/useMyWorkPackages'
import { useProjects } from '@/hooks/use-projects'
import { formatDate } from '@/lib/utils'

// Widget: Assigned work packages
function MyWorkWidget() {
  const { data, isLoading } = useMyWorkPackages()

  if (isLoading) return <WidgetSkeleton />
  const wps = data ?? []

  if (wps.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No assigned work packages
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {wps.slice(0, 5).map((wp: any) => (
        <Link
          key={wp.id}
          href={`/projects/${wp.projectId}/work-packages/${wp.id}`}
          className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              wp.status === 'open' ? 'bg-green-500' :
              wp.status === 'in_progress' ? 'bg-blue-500' :
              wp.status === 'closed' ? 'bg-gray-400' : 'bg-yellow-500'
            }`} />
            <span className="text-sm text-gray-900 truncate">{wp.subject}</span>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
            {wp.dueDate ? formatDate(wp.dueDate) : 'No due date'}
          </span>
        </Link>
      ))}
      {wps.length > 5 && (
        <Link
          href="/my-work"
          className="block text-center text-sm text-blue-600 hover:text-blue-700 mt-2"
        >
          View all ({wps.length})
        </Link>
      )}
    </div>
  )
}

// Widget: Recent project activity
function RecentActivityWidget() {
  // TODO: replace with activity feed hook when available
  return (
    <div className="text-sm text-gray-500 text-center py-4">
      No recent activity
    </div>
  )
}

// Widget: My projects
function MyProjectsWidget() {
  const { data, isLoading } = useProjects()
  const { user } = useCurrentUser()

  if (isLoading) return <WidgetSkeleton />
  const projects = data ?? []

  // Filter to projects where user is a member (simplified)
  const myProjects = projects.slice(0, 6)

  if (myProjects.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No active projects
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {myProjects.map((project: any) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition"
        >
          <div className="text-sm font-medium text-gray-900 truncate">
            {project.name}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {project._count?.members ?? 0} members
          </div>
        </Link>
      ))}
    </div>
  )
}

// Widget: Unread notifications
function NotificationWidget() {
  const { data } = useNotifications(1)
  const unread = data?.meta?.unreadCount ?? 0

  return (
    <div className="text-center">
      <div className="text-4xl font-bold text-blue-600">{unread}</div>
      <div className="text-sm text-gray-500 mt-1">
        unread notification{unread !== 1 ? 's' : ''}
      </div>
      {unread > 0 && (
        <Link
          href="/notifications"
          className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          View all →
        </Link>
      )}
    </div>
  )
}

function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-8 bg-gray-200 rounded" />
      ))}
    </div>
  )
}

function SectionCard({
  title,
  icon,
  children,
  action,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-semibold text-gray-900">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

export default function MyPage() {
  const { user, isLoading: userLoading } = useCurrentUser()

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            My Page
          </h1>
          {user && (
            <p className="text-gray-500 mt-1">
              Welcome back, {user.name ?? user.email}
            </p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-3xl font-bold text-blue-600">
              <MyWorkWidget />
            </div>
          </div>
          <NotificationWidget />
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-green-600">
              <MyProjectsWidget />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">
              <RecentActivityWidget />
            </div>
          </div>
        </div>

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Work */}
          <SectionCard
            title="My Work"
            icon={<span>📋</span>}
            action={
              <Link href="/my-work" className="text-sm text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            }
          >
            <MyWorkWidget />
          </SectionCard>

          {/* My Projects */}
          <SectionCard
            title="My Projects"
            icon={<span>📁</span>}
            action={
              <Link href="/projects" className="text-sm text-blue-600 hover:text-blue-700">
                All projects →
              </Link>
            }
          >
            <MyProjectsWidget />
          </SectionCard>

          {/* Recent Activity */}
          <SectionCard
            title="Recent Activity"
            icon={<span>⚡</span>}
          >
            <RecentActivityWidget />
          </SectionCard>

          {/* Notification Settings */}
          <SectionCard
            title="Quick Links"
            icon={<span>🔗</span>}
          >
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/notifications"
                className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-sm text-center"
              >
                🔔 Notifications
              </Link>
              <Link
                href="/time-entries"
                className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-sm text-center"
              >
                ⏱️ Time Entries
              </Link>
              <Link
                href="/settings"
                className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-sm text-center"
              >
                ⚙️ Settings
              </Link>
              <Link
                href="/help"
                className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-sm text-center"
              >
                ❓ Help
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

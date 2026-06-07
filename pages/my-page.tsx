'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useNotifications } from '@/hooks/useNotifications'
import { useMyWorkPackages } from '@/hooks/useMyWorkPackages'
import { useProjects } from '@/hooks/use-projects'
import { useMyPage, useSaveMyPage } from '@/hooks/useMyPage'
import { MyPageWidget } from '@/components/my-page'
import { AssignedWorkPackagesWidget, TimeEntriesWidget, UpcomingMeetingsWidget } from '@/components/my-page/widgets'
import { formatDate } from '@/lib/utils'

const WIDGET_MAP: Record<string, React.ComponentType<{ config?: Record<string, unknown> }>> = {
  assigned_work_packages: AssignedWorkPackagesWidget,
  watched_work_packages: AssignedWorkPackagesWidget,
  time_entries_this_week: TimeEntriesWidget,
  upcoming_meetings: UpcomingMeetingsWidget,
}

// Legacy widgets for the default dashboard view
function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-8 bg-gray-200 rounded" />
      ))}
    </div>
  )
}

function MyWorkWidget() {
  const { data, isLoading } = useMyWorkPackages()
  if (isLoading) return <WidgetSkeleton />
  const wps = data ?? []
  if (wps.length === 0) {
    return <div className="text-sm text-gray-500 text-center py-4">No assigned work packages</div>
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
        <Link href="/my-work" className="block text-center text-sm text-blue-600 hover:text-blue-700 mt-2">
          View all ({wps.length})
        </Link>
      )}
    </div>
  )
}

function RecentActivityWidget() {
  return <div className="text-sm text-gray-500 text-center py-4">No recent activity</div>
}

function MyProjectsWidget() {
  const { data, isLoading } = useProjects()
  const { user } = useCurrentUser()
  if (isLoading) return <WidgetSkeleton />
  const projects = data ?? []
  const myProjects = projects.slice(0, 6)
  if (myProjects.length === 0) {
    return <div className="text-sm text-gray-500 text-center py-4">No active projects</div>
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {myProjects.map((project: any) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition"
        >
          <div className="text-sm font-medium text-gray-900 truncate">{project.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">{project._count?.members ?? 0} members</div>
        </Link>
      ))}
    </div>
  )
}

function NotificationWidget() {
  // Pre-existing bug: was `useNotifications(1)` — typed signature is
  // `useNotifications({ page?, perPage?, unreadOnly? })`, so the bare
  // `1` was treated as the options object and the hook's runtime read
  // of `options.page` would have been undefined, silently fetching
  // the default page anyway but logging a type error. Pass an actual
  // options bag.
  const { data } = useNotifications({ page: 1, perPage: 1 })
  const unread = data?.data?.meta?.unreadCount ?? 0
  return (
    <div className="text-center">
      <div className="text-4xl font-bold text-blue-600">{unread}</div>
      <div className="text-sm text-gray-500 mt-1">unread notification{unread !== 1 ? 's' : ''}</div>
      {unread > 0 && (
        <Link href="/notifications" className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-700">
          View all →
        </Link>
      )}
    </div>
  )
}

function SectionCard({ title, icon, children, action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode
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
      <div className="p-4">{children}</div>
    </div>
  )
}

export default function MyPagePage() {
  const { user, isLoading: userLoading } = useCurrentUser()
  const { data: widgets, isLoading: widgetsLoading } = useMyPage()
  const saveMyPage = useSaveMyPage()
  const [editMode, setEditMode] = useState(false)

  const handleSave = () => {
    if (widgets) saveMyPage.mutate(widgets)
    setEditMode(false)
  }

  if (widgetsLoading || !widgets || widgets.length === 0) {
    // Fallback to legacy dashboard layout
    return (
      <AuthenticatedLayout>
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Page</h1>
            {user && <p className="text-gray-500 mt-1">Welcome back, {user.name ?? user.email}</p>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-3xl font-bold text-blue-600"><MyWorkWidget /></div>
            </div>
            <NotificationWidget />
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-green-600"><MyProjectsWidget /></div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-purple-600"><RecentActivityWidget /></div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="My Work" icon={<span>📋</span>} action={<Link href="/my-work" className="text-sm text-blue-600 hover:text-blue-700">View all →</Link>}>
              <MyWorkWidget />
            </SectionCard>
            <SectionCard title="My Projects" icon={<span>📁</span>} action={<Link href="/projects" className="text-sm text-blue-600 hover:text-blue-700">All projects →</Link>}>
              <MyProjectsWidget />
            </SectionCard>
            <SectionCard title="Recent Activity" icon={<span>⚡</span>}>
              <RecentActivityWidget />
            </SectionCard>
            <SectionCard title="Quick Links" icon={<span>🔗</span>}>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/notifications" className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-sm text-center">🔔 Notifications</Link>
                <Link href="/time-entries" className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-sm text-center">⏱️ Time Entries</Link>
                <Link href="/settings" className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-sm text-center">⚙️ Settings</Link>
                <Link href="/help" className="p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 text-sm text-center">❓ Help</Link>
              </div>
            </SectionCard>
          </div>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Page</h1>
          <Button
            variant={editMode ? 'primary' : 'secondary'}
            onClick={editMode ? handleSave : () => setEditMode(true)}
            isLoading={saveMyPage.isPending}
          >
            {editMode ? 'Done Editing' : 'Edit Layout'}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {widgets?.map((widget) => {
            const WidgetComponent = WIDGET_MAP[widget.type]
            if (!WidgetComponent) return null
            return (
              <div
                key={widget.id}
                className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-4 min-h-48"
                style={{ gridColumn: widget.position ? `span ${widget.position.w}` : undefined }}
              >
                <MyPageWidget widget={widget} editMode={editMode}>
                  <WidgetComponent config={widget.config} />
                </MyPageWidget>
              </div>
            )
          })}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
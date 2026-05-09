'use client'
import React, { useState } from 'react'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui'
import { useMyPage, useSaveMyPage, type MyPageWidget } from '@/hooks/useMyPage'
import {
  MyPageWidget,
  AssignedWorkPackagesWidget,
  TimeEntriesWidget,
  UpcomingMeetingsWidget,
} from '@/components/my-page'

const WIDGET_MAP: Record<string, React.ComponentType<{ config?: Record<string, unknown> }>> = {
  assigned_work_packages: AssignedWorkPackagesWidget,
  watched_work_packages: AssignedWorkPackagesWidget, // reuse same component
  time_entries_this_week: TimeEntriesWidget,
  upcoming_meetings: UpcomingMeetingsWidget,
}

export default function MyPagePage() {
  const { data: widgets, isLoading } = useMyPage()
  const saveMyPage = useSaveMyPage()
  const [editMode, setEditMode] = useState(false)

  const handleSave = () => {
    if (widgets) {
      saveMyPage.mutate(widgets)
    }
    setEditMode(false)
  }

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-48 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
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

        {/* Widget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {widgets?.map((widget) => {
            const WidgetComponent = WIDGET_MAP[widget.type]
            if (!WidgetComponent) return null
            return (
              <div
                key={widget.id}
                className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-4 min-h-48"
                style={{
                  gridColumn: widget.position ? `span ${widget.position.w}` : undefined,
                }}
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
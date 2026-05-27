export const dynamic = 'force-dynamic'

import React from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { WorkPackageCalendar } from '@/components/work-packages/calendar'
import type { WorkPackageFilter } from '@/types'

export default function CalendarPage() {
  const router = useRouter()
  const { projectId } = router.query

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  const initialFilters: WorkPackageFilter = {
    projectId: projectId as string,
  }

  return (
    <AuthenticatedLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href={`/projects/${projectId}`}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Project
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Calendar View</h1>
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-hidden">
          <WorkPackageCalendar
            initialFilters={initialFilters}
            projectId={projectId as string}
          />
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
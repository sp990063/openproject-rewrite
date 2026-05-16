export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { ActivityFilters } from '@/components/activity/ActivityFilters'

const VALID_SUBJECT_TYPES = [
  'work_package',
  'wiki_page',
  'forum_post',
  'document',
  'meeting',
  'news',
  'time_entry',
  'member',
  'version',
] as const

interface ActivityResponse {
  activities: Activity[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface Activity {
  id: string
  projectId: string
  userId: string
  subjectType: string
  subjectId: string
  action: string
  details: unknown
  mentionIds: string[]
  reference: unknown
  isArchived: boolean
  createdAt: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  comments: Array<{
    id: string
    userId: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string
      avatarUrl: string | null
    }
  }>
}

async function fetchProjectActivity(
  projectId: string,
  page: number = 1,
  limit: number = 50,
  filters: string[] = [],
  includeArchived: boolean = false
): Promise<ActivityResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  
  if (filters.length > 0) {
    params.set('filter', filters.join(','))
  }
  
  if (includeArchived) {
    params.set('includeArchived', 'true')
  }
  
  const res = await fetch(`/api/projects/${projectId}/activity?${params}`)
  if (!res.ok) throw new Error('Failed to fetch activity')
  return res.json()
}

export default function ActivityIndexPage() {
  const router = useRouter()
  const { projectId } = router.query

  const [selectedFilters, setSelectedFilters] = useState<string[]>([])
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', projectId, 'activity', { page, filters: selectedFilters, includeArchived }],
    queryFn: () => fetchProjectActivity(projectId as string, page, 50, selectedFilters, includeArchived),
    enabled: !!projectId,
  })

  const handleFiltersChange = (filters: string[]) => {
    setSelectedFilters(filters)
    setPage(1) // Reset to first page when filters change
  }

  const handleClearFilters = () => {
    setSelectedFilters([])
    setIncludeArchived(false)
    setPage(1)
  }

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Project
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
              <p className="text-gray-500 text-sm mt-1">
                Recent activity in this project
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Filter Sidebar */}
          <div className="w-64 flex-shrink-0">
            <ActivityFilters
              selectedFilters={selectedFilters}
              onChange={handleFiltersChange}
              includeArchived={includeArchived}
              onIncludeArchivedChange={setIncludeArchived}
              onClearAll={handleClearFilters}
            />
          </div>

          {/* Activity Feed */}
          <div className="flex-1 min-w-0">
            {isLoading && (
              <ActivityFeed activities={[]} isLoading={true} />
            )}

            {error && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="text-red-500 mb-2">Failed to load activity</div>
                <p className="text-gray-500 text-sm">Please try again later.</p>
              </div>
            )}

            {!isLoading && !error && data?.activities.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
                <p className="text-gray-500 text-sm">
                  When team members create or update work packages, wiki pages, or other items, their activity will appear here.
                </p>
              </div>
            )}

            {!isLoading && !error && data?.activities && data.activities.length > 0 && (
              <>
                <ActivityFeed activities={data.activities} isLoading={false} />

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= data.pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

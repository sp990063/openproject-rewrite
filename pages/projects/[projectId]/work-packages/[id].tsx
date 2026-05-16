export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { useWorkPackage, useUpdateWorkPackage } from '@/hooks/use-work-packages'
import { SubjectInlineEdit } from '@/components/work-packages/detail/SubjectInlineEdit'
import { DescriptionEditor } from '@/components/work-packages/detail/DescriptionEditor'
import { AttributeSidebar } from '@/components/work-packages/detail/AttributeSidebar'
import { ActivityFeed } from '@/components/work-packages/detail/ActivityFeed'
import { RelationsList } from '@/components/work-packages/detail/RelationsList'
import { Button, Badge } from '@/components/ui'
import { WatchButton } from '@/components/work-packages/detail/WatchButton'

export default function WorkPackageDetailPage() {
  const router = useRouter()
  const { projectId, id } = router.query as { projectId: string; id: string }

  const { data: wp, isLoading, error } = useWorkPackage(id)
  const updateWorkPackage = useUpdateWorkPackage()

  const [activeTab, setActiveTab] = useState<'activity' | 'relations'>('activity')

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <DetailSkeleton />
      </AuthenticatedLayout>
    )
  }

  if (error || !wp) {
    return (
      <AuthenticatedLayout>
        <div className="max-w-5xl mx-auto py-12 text-center">
          <p className="text-red-500 mb-4">Failed to load work package.</p>
          <Button variant="secondary" onClick={() => router.back()}>Go back</Button>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <Link href={`/projects/${projectId}`} className="hover:text-gray-700">Project</Link>
          <span>/</span>
          <Link href={`/projects/${projectId}/work-packages`} className="hover:text-gray-700">Work Packages</Link>
          <span>/</span>
          <span className="text-gray-900 truncate max-w-xs">{wp.subject}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {wp.type && (
                <Badge
                  style={{ backgroundColor: (wp.type.color ?? '#6366F1') + '20', color: wp.type.color ?? '#6366F1' }}
                >
                  {wp.type.name}
                </Badge>
              )}
            </div>

            <SubjectInlineEdit
              subject={wp.subject}
              onSave={async (subject) => {
                await updateWorkPackage.mutateAsync({ id: wp.id, data: { subject } })
              }}
            />
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <WatchButton workPackageId={wp.id} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/projects/${projectId}/work-packages`)}
            >
              ← List
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Left column: Description + Tabs */}
          <div className="flex flex-col gap-6 min-w-0">
            {/* Description */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Description</h2>
              <DescriptionEditor
                description={wp.description ?? ''}
                onSave={async (description) => {
                  await updateWorkPackage.mutateAsync({ id: wp.id, data: { description } })
                }}
                isSaving={updateWorkPackage.isPending}
              />
            </section>

            {/* Tabs: Activity / Relations */}
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200">
                <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')}>
                  Activity
                </TabButton>
                <TabButton active={activeTab === 'relations'} onClick={() => setActiveTab('relations')}>
                  Relations
                </TabButton>
              </div>
              <div className="p-4">
                {activeTab === 'activity' && <ActivityFeed workPackageId={wp.id} />}
                {activeTab === 'relations' && <RelationsList workPackageId={wp.id} />}
              </div>
            </section>
          </div>

          {/* Right column: Attributes */}
          <aside>
            <AttributeSidebar workPackage={wp} />
          </aside>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function DetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="mb-4 h-4 w-64 bg-gray-200 rounded" />
      <div className="mb-6">
        <div className="h-8 w-96 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
      </div>
      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4">
          <div className="h-40 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-80 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}

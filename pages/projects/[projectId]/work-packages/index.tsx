import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal, Input } from '@/components/ui'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useCreateWorkPackage } from '@/hooks/use-work-packages'
import { WorkPackageTable } from '@/components/work-packages/table'
import { GanttChart } from '@/components/work-packages/gantt'
import { WorkPackageBoard } from '@/components/work-packages/board'
import { WorkPackageCalendar } from '@/components/work-packages/calendar'
import { QuerySwitcher } from '@/components/work-packages/query/QuerySwitcher'
import { SaveQueryDialog } from '@/components/work-packages/query/SaveQueryDialog'
import type { WorkPackageFilter, Query, SortBy } from '@/types'
import type { SortState } from '@/components/work-packages/table/types'

export const dynamic = 'force-dynamic'

type ViewMode = 'table' | 'gantt' | 'board' | 'calendar'

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'gantt', label: 'Gantt' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
]

export default function WorkPackagesPage() {
  const router = useRouter()
  const { projectId } = router.query

  // ── View mode (persisted in URL) ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = router.query.view as string | undefined
    if (VIEW_MODES.some((m) => m.value === v)) return v as ViewMode
    return 'table'
  })

  // ── Query (saved filter) state ───────────────────────────────────────────────
  const [currentQuery, setCurrentQuery] = useState<Query | null>(null)
  const [filters, setFilters] = useState<Partial<WorkPackageFilter>>(() => ({
    projectId: projectId as string | undefined,
  }))
  const [sort] = useState<SortState | null>(null)
  const [groupBy] = useState<string | null>(null)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [editingQuery, setEditingQuery] = useState<Query | null>(null)
  const [isSavingQuery, setIsSavingQuery] = useState(false)

  // ── Create Work Package modal ─────────────────────────────────────────────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newWPSubject, setNewWPSubject] = useState('')
  const [newWPDescription, setNewWPDescription] = useState('')
  const createWorkPackage = useCreateWorkPackage()

  // ── Sync view mode to URL ─────────────────────────────────────────────────────
  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    const query: Record<string, string> = {}
    if (mode !== 'table') query.view = mode
    if (currentQuery) query.queryId = currentQuery.id
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
  }, [router, currentQuery])

  // ── Query selection ────────────────────────────────────────────────────────────
  const handleSelectQuery = useCallback((query: Query | null) => {
    setCurrentQuery(query)
    if (query?.filters) {
      setFilters({ ...query.filters, projectId: projectId as string })
    } else {
      setFilters({ projectId: projectId as string })
    }
  }, [projectId])

  // ── Filter changes from Table/Gantt/Board/Calendar ─────────────────────────
  const handleFiltersChange = useCallback((newFilters: WorkPackageFilter) => {
    setFilters(newFilters)
  }, [])

  // ── Open Save dialog (from filter bar or QuerySwitcher) ─────────────────────
  const handleOpenSaveDialog = useCallback(() => {
    setIsSaveDialogOpen(true)
  }, [])

  // ── Create Work Package ────────────────────────────────────────────────────────
  const handleCreateWP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) return

    try {
      await createWorkPackage.mutateAsync({
        projectId: projectId as string,
        subject: newWPSubject,
        description: newWPDescription,
        statusId: 'status-new',
        typeId: 'task',
        priorityId: 'normal',
        authorId: 'system',
      })
      setIsCreateModalOpen(false)
      setNewWPSubject('')
      setNewWPDescription('')
    } catch (error) {
      console.error('Failed to create work package:', error)
    }
  }

  const resolvedFilters: WorkPackageFilter = {
    ...filters as WorkPackageFilter,
    projectId: projectId as string | undefined,
  }

  const sortBy: SortBy[] = sort ? [[sort.columnId as string, sort.direction]] : []

  return (
    <AuthenticatedLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to Project
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Work Packages</h1>
            </div>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              New Work Package
            </Button>
          </div>

          {/* Toolbar: Query Switcher + View Switcher */}
          <div className="flex items-center justify-between gap-4">
            <QuerySwitcher
              projectId={projectId as string}
              currentQueryId={currentQuery?.id}
              onSelectQuery={handleSelectQuery}
              onSaveQuery={handleOpenSaveDialog}
            />

            <Tabs value={viewMode} onValueChange={(v) => handleViewChange(v as ViewMode)}>
              <TabsList>
                {VIEW_MODES.map((mode) => (
                  <TabsTrigger key={mode.value} value={mode.value}>
                    {mode.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* View Content — all four views live here but only one is visible */}
        {/* (Using CSS display instead of TabsContent to avoid Radix TabsContent child requirement) */}
        <div className="flex-1 overflow-hidden relative">
          <div className={viewMode === 'table' ? 'block' : 'hidden'} style={{ height: '100%' }}>
            <WorkPackageTable
              initialFilters={resolvedFilters}
              initialSort={sort}
              projectId={projectId as string}
              onFiltersChange={handleFiltersChange}
              onSave={handleOpenSaveDialog}
              isSaving={isSavingQuery}
            />
          </div>
          <div className={viewMode === 'gantt' ? 'block' : 'hidden'} style={{ height: '100%' }}>
            <GanttChart
              initialFilters={resolvedFilters}
              projectId={projectId as string}
            />
          </div>
          <div className={viewMode === 'board' ? 'block' : 'hidden'} style={{ height: '100%' }}>
            <WorkPackageBoard
              initialFilters={resolvedFilters}
              projectId={projectId as string}
            />
          </div>
          <div className={viewMode === 'calendar' ? 'block' : 'hidden'} style={{ height: '100%' }}>
            <WorkPackageCalendar
              initialFilters={resolvedFilters}
              projectId={projectId as string}
            />
          </div>
        </div>
      </div>

      {/* Create Work Package Modal */}
      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Create Work Package"
        description="Create a new work package for this project."
      >
        <form onSubmit={handleCreateWP} className="space-y-4">
          <Input
            label="Subject"
            value={newWPSubject}
            onChange={(e) => setNewWPSubject(e.target.value)}
            placeholder="Work package subject"
            required
          />
          <Input
            label="Description"
            value={newWPDescription}
            onChange={(e) => setNewWPDescription(e.target.value)}
            placeholder="Optional description"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={createWorkPackage.isPending}
            >
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Save Query Dialog */}
      <SaveQueryDialog
        open={isSaveDialogOpen}
        onOpenChange={(open) => {
          setIsSaveDialogOpen(open)
          if (!open) {
            setEditingQuery(null)
          }
        }}
        currentFilters={filters as WorkPackageFilter}
        currentSortBy={sortBy}
        currentGroupBy={groupBy}
        displayMode={viewMode}
        projectId={projectId as string}
        editingQuery={editingQuery}
        onSaved={(query) => {
          setCurrentQuery(query)
          setIsSaveDialogOpen(false)
          setEditingQuery(null)
        }}
      />
    </AuthenticatedLayout>
  )
}

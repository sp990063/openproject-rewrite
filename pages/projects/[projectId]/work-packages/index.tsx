export const dynamic = 'force-dynamic'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal, Input } from '@/components/ui'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useCreateWorkPackage } from '@/hooks/use-work-packages'
// P1-E: dynamic-import the 3 secondary views so they only join the bundle
// when the user actually switches to Gantt/Board/Calendar. The default
// `table` view stays statically imported.
// NOTE: we use an aliased import to avoid clashing with the
// `export const dynamic = 'force-dynamic'` declaration on line 1.
import nextDynamic from 'next/dynamic'
import { WorkPackageTable } from '@/components/work-packages/table'
const GanttChart = nextDynamic(
  () => import('@/components/work-packages/gantt').then((m) => m.GanttChart),
  { ssr: false, loading: () => <div className="p-8 text-text-muted">Loading Gantt…</div> }
)
const WorkPackageBoard = nextDynamic(
  () => import('@/components/work-packages/board').then((m) => m.WorkPackageBoard),
  { ssr: false, loading: () => <div className="p-8 text-text-muted">Loading Board…</div> }
)
const WorkPackageCalendar = nextDynamic(
  () => import('@/components/work-packages/calendar').then((m) => m.WorkPackageCalendar),
  { ssr: false, loading: () => <div className="p-8 text-text-muted">Loading Calendar…</div> }
)
import { QuerySwitcher } from '@/components/work-packages/query/QuerySwitcher'
import { SaveQueryDialog } from '@/components/work-packages/query/SaveQueryDialog'
import { ExportDialog } from '@/components/exports/ExportDialog'
import type { WorkPackageFilter, Query, SortBy } from '@/types'
import type { SortState } from '@/components/work-packages/table/types'
import type { ExportFormat } from '@/lib/exporters/pdf'
import { elementToPDF } from '@/lib/exporters/pdf'

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

  // ── Sync URL → viewMode (handles browser back/forward & initial SSR hydrate) ─
  useEffect(() => {
    const v = router.query.view as string | undefined
    if (VIEW_MODES.some((m) => m.value === v)) {
      setViewMode(v as ViewMode)
    } else {
      setViewMode('table')
    }
  }, [router.query.view])

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

  // ── Export modal ────────────────────────────────────────────────────────────
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

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

  // ── Export Work Packages ─────────────────────────────────────────────────────
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!projectId) return

    setIsExporting(true)
    try {
      if (format === 'csv') {
        // Redirect to CSV endpoint
        window.location.href = `/api/work-packages?projectId=${projectId}&format=csv`
      } else if (format === 'pdf') {
        // Find the table element and convert to PDF
        const tableEl = document.querySelector('[data-work-packages-table]') as HTMLElement
        if (tableEl) {
          await elementToPDF(tableEl, {
            filename: `work-packages-${projectId}`,
            title: 'Work Packages Export',
            scale: 2,
          })
        } else {
          // Fallback: fetch data and generate simple PDF
          const response = await fetch(`/api/work-packages?projectId=${projectId}`)
          const data = await response.json()
          if (Array.isArray(data)) {
            const { generateDataPDF } = await import('@/lib/exporters/pdf')
            generateDataPDF(
              data.map((wp: { id: string; subject: string; status: { name: string }; type: { name: string }; dueDate: string | null }) => ({
                id: wp.id,
                subject: wp.subject,
                status: wp.status?.name ?? '',
                type: wp.type?.name ?? '',
                dueDate: wp.dueDate ?? '',
              })),
              [
                { key: 'id', header: 'ID' },
                { key: 'subject', header: 'Subject' },
                { key: 'status', header: 'Status' },
                { key: 'type', header: 'Type' },
                { key: 'dueDate', header: 'Due Date' },
              ],
              { filename: `work-packages-${projectId}`, title: 'Work Packages Export' }
            )
          }
        }
      }
      // XLSX would require additional xlsx package
    } catch (error) {
      console.error('Failed to export:', error)
    } finally {
      setIsExporting(false)
    }
  }, [projectId])

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
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setIsExportDialogOpen(true)}>
                Export
              </Button>
              <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                New Work Package
              </Button>
            </div>
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

      {/* Export Dialog */}
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        onExport={handleExport}
        title="Export Work Packages"
        description="Choose a format to export your work packages."
        isLoading={isExporting}
      />
    </AuthenticatedLayout>
  )
}

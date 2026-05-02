import React, { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import { useCreateSavedQuery, useUpdateSavedQuery } from '@/hooks/use-queries'
import type { WorkPackageFilter, SortBy, Query } from '@/types'

interface SaveQueryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentFilters: Partial<WorkPackageFilter>
  currentSortBy: SortBy[]
  currentGroupBy?: string | null
  displayMode?: 'table' | 'gantt' | 'board' | 'calendar'
  projectId?: string
  /** When a query is being edited (not saved as new) */
  editingQuery?: Query | null
  onSaved?: (query: Query) => void
}

export function SaveQueryDialog({
  open,
  onOpenChange,
  currentFilters,
  currentSortBy,
  currentGroupBy,
  displayMode = 'table',
  projectId,
  editingQuery,
  onSaved,
}: SaveQueryDialogProps) {
  const [name, setName] = useState(editingQuery?.name ?? '')
  const [isDefault, setIsDefault] = useState(editingQuery?.isDefault ?? false)
  const createSavedQuery = useCreateSavedQuery()
  const updateSavedQuery = useUpdateSavedQuery()

  const isEditing = !!editingQuery
  const isLoading = isEditing ? updateSavedQuery.isPending : createSavedQuery.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      let query: Query
      if (isEditing && editingQuery) {
        query = await updateSavedQuery.mutateAsync({
          id: editingQuery.id,
          data: { name: name.trim(), isDefault },
        })
      } else {
        query = await createSavedQuery.mutateAsync({
          name: name.trim(),
          projectId,
          filters: currentFilters as WorkPackageFilter,
          sortBy: currentSortBy,
          groupBy: currentGroupBy ?? null,
          displayMode,
          isDefault,
        })
      }
      onSaved?.(query)
      onOpenChange(false)
      setName('')
    } catch {
      // TODO: show error toast
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setName(editingQuery?.name ?? '')
      setIsDefault(editingQuery?.isDefault ?? false)
      onOpenChange(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={handleClose} title={isEditing ? 'Edit view' : 'Save view'}>
      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            View name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Open Tasks, Sprint Backlog..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            autoFocus
            maxLength={100}
            disabled={isLoading}
          />
        </div>

        {/* Summary of current filter state */}
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-1">
          <div className="font-medium text-gray-700 mb-1">Current state:</div>
          {Object.entries(currentFilters).filter(([, v]) => v != null && (!Array.isArray(v) || v.length > 0)).length > 0 ? (
            Object.entries(currentFilters).map(([key, val]) =>
              val != null && (!Array.isArray(val) || val.length > 0) ? (
                <div key={key}>
                  <span className="font-medium">{key}:</span>{' '}
                  {Array.isArray(val) ? val.join(', ') : String(val)}
                </div>
              ) : null
            )
          ) : (
            <div>No filters active (showing all work packages)</div>
          )}
          {currentSortBy.length > 0 && (
            <div>
              <span className="font-medium">Sort:</span>{' '}
              {currentSortBy.map(([col, dir]) => `${col} (${dir})`).join(', ')}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            disabled={isLoading}
          />
          <span className="text-sm text-gray-700">Set as default view</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isLoading}
            disabled={!name.trim()}
          >
            {isEditing ? 'Save changes' : 'Save view'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

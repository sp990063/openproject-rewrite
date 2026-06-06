// components/work-packages/table/hooks/useWorkPackageInlineEdit.ts
// Inline cell editing state + handlers for the work-package table.
//
// Tracks which cell is being edited (rowId + columnId) and the DOMRect
// of the cell (used by the portal-rendered editor to position itself
// next to the cell). Provides open/close + a save handler that maps the
// column id to the correct update-work-package field and handles
// date/number coercion.
'use client'

import { useCallback, useState } from 'react'
import type { ColumnId } from '../types'
import type { InlineEditSaveEvent } from '../WorkPackageInlineEdit'
import { useUpdateWorkPackage } from '@/hooks/use-work-packages'

const COLUMN_TO_FIELD: Record<ColumnId, string> = {
  subject: 'subject',
  status: 'statusId',
  type: 'typeId',
  priority: 'priorityId',
  assignee: 'assigneeId',
  startDate: 'startDate',
  dueDate: 'dueDate',
  estimatedHours: 'estimatedHours',
}

export interface UseWorkPackageInlineEditResult {
  editing: { rowId: string; columnId: ColumnId } | null
  editingCellRect: DOMRect | null
  openEdit: (rowId: string, columnId: ColumnId, rect: DOMRect | null) => void
  cancelEdit: () => void
  saveEdit: (event: InlineEditSaveEvent) => Promise<boolean>
}

export function useWorkPackageInlineEdit(): UseWorkPackageInlineEditResult {
  const [editing, setEditing] = useState<{
    rowId: string
    columnId: ColumnId
  } | null>(null)
  const [editingCellRect, setEditingCellRect] = useState<DOMRect | null>(null)
  const updateWorkPackage = useUpdateWorkPackage()

  const openEdit = useCallback(
    (rowId: string, columnId: ColumnId, rect: DOMRect | null) => {
      setEditingCellRect(rect)
      setEditing({ rowId, columnId })
    },
    [],
  )

  const cancelEdit = useCallback(() => {
    setEditing(null)
    setEditingCellRect(null)
  }, [])

  const saveEdit = useCallback(
    async (event: InlineEditSaveEvent): Promise<boolean> => {
      const { rowId, columnId, value } = event
      const field = COLUMN_TO_FIELD[columnId]
      if (!field) return true

      const updateData: Record<string, unknown> = { [field]: value }
      // Date columns receive `YYYY-MM-DD` strings from the date input;
      // convert to ISO datetime before sending to the API.
      if ((columnId === 'startDate' || columnId === 'dueDate') && value) {
        updateData[field] = new Date(value as string).toISOString()
      }
      // estimatedHours arrives as a string from the number input; coerce.
      if (columnId === 'estimatedHours' && value !== null && value !== '') {
        updateData[field] = Number(value)
      }

      try {
        await updateWorkPackage.mutateAsync({
          id: rowId,
          data: updateData as Parameters<typeof updateWorkPackage.mutateAsync>[0]['data'],
        })
        return true
      } catch {
        return false
      }
    },
    [updateWorkPackage],
  )

  return { editing, editingCellRect, openEdit, cancelEdit, saveEdit }
}

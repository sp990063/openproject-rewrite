import React, { useState, useCallback } from 'react'
import type { WorkPackage, Status, Priority, User } from '@/types'
import { useUpdateWorkPackage } from '@/hooks/use-work-packages'
import { Select } from '@/components/ui'
import { formatDate } from '@/lib/utils'

interface AttributeSidebarProps {
  workPackage: WorkPackage
}

export function AttributeSidebar({ workPackage: wp }: AttributeSidebarProps) {
  const updateWorkPackage = useUpdateWorkPackage()
  const [editingField, setEditingField] = useState<string | null>(null)

  const handleUpdate = useCallback(
    async (field: string, value: string | null) => {
      setEditingField(null)
      try {
        await updateWorkPackage.mutateAsync({
          id: wp.id,
          data: { [field]: value },
        })
      } catch {
        // Silently fail — field reverts automatically via React state
      }
    },
    [wp.id, updateWorkPackage]
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">Properties</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Status */}
        <AttributeRow
          label="Status"
          editingField={editingField}
          fieldKey="status"
          onEdit={() => setEditingField('status')}
          onCancel={() => setEditingField(null)}
        >
          <Select
            value={wp.statusId ?? ''}
            options={[]} // TODO: populate from API
            onChange={(e) => handleUpdate('statusId', e.target.value)}
            onBlur={() => setEditingField(null)}
          />
          {!editingField && (
            <span
              className="inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80"
              onClick={() => setEditingField('status')}
              title="Click to change"
            >
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: wp.status?.color ?? '#6B7280' }}
              />
              <span className="text-sm text-gray-800">{wp.status?.name ?? 'Unknown'}</span>
            </span>
          )}
        </AttributeRow>

        {/* Priority */}
        <AttributeRow
          label="Priority"
          editingField={editingField}
          fieldKey="priority"
          onEdit={() => setEditingField('priority')}
          onCancel={() => setEditingField(null)}
        >
          <Select
            value={wp.priorityId ?? ''}
            options={[]} // TODO: populate from API
            onChange={(e) => handleUpdate('priorityId', e.target.value)}
            onBlur={() => setEditingField(null)}
          />
          {!editingField && (
            <span
              className="text-sm text-gray-800 cursor-pointer hover:opacity-80"
              onClick={() => setEditingField('priority')}
              title="Click to change"
            >
              {wp.priority?.name ?? 'None'}
            </span>
          )}
        </AttributeRow>

        {/* Assignee */}
        <AttributeRow
          label="Assignee"
          editingField={editingField}
          fieldKey="assignee"
          onEdit={() => setEditingField('assignee')}
          onCancel={() => setEditingField(null)}
        >
          {!editingField && (
            <span
              className="flex items-center gap-2 cursor-pointer hover:opacity-80"
              onClick={() => setEditingField('assignee')}
              title="Click to change"
            >
              {wp.assignee ? (
                <>
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: stringToColor(wp.assignee.name) }}
                  >
                    {wp.assignee.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-800 truncate">{wp.assignee.name}</span>
                </>
              ) : (
                <span className="text-sm text-gray-400 italic">Unassigned</span>
              )}
            </span>
          )}
          {editingField === 'assignee' && (
            <input
              type="text"
              placeholder="Assignee name..."
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-200"
              autoFocus
              onBlur={(e) => handleUpdate('assigneeName', e.target.value || null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value
                  void handleUpdate('assigneeName', val || null)
                }
                if (e.key === 'Escape') setEditingField(null)
              }}
            />
          )}
        </AttributeRow>

        {/* Start Date */}
        <AttributeRow
          label="Start Date"
          editingField={editingField}
          fieldKey="startDate"
          onEdit={() => setEditingField('startDate')}
          onCancel={() => setEditingField(null)}
        >
          {editingField === 'startDate' ? (
            <input
              type="date"
              value={wp.startDate instanceof Date ? formatDateForInput(wp.startDate) : ''}
              onChange={(e) => handleUpdate('startDate', e.target.value || null)}
              onBlur={() => setEditingField(null)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-200"
              autoFocus
            />
          ) : (
            <span
              className="text-sm text-gray-800 cursor-pointer hover:opacity-80"
              onClick={() => setEditingField('startDate')}
              title="Click to change"
            >
              {wp.startDate ? formatDate(wp.startDate) : <span className="text-gray-400 italic">No start date</span>}
            </span>
          )}
        </AttributeRow>

        {/* Due Date */}
        <AttributeRow
          label="Due Date"
          editingField={editingField}
          fieldKey="dueDate"
          onEdit={() => setEditingField('dueDate')}
          onCancel={() => setEditingField(null)}
        >
          {editingField === 'dueDate' ? (
            <input
              type="date"
              value={wp.dueDate instanceof Date ? formatDateForInput(wp.dueDate) : ''}
              onChange={(e) => handleUpdate('dueDate', e.target.value || null)}
              onBlur={() => setEditingField(null)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-200"
              autoFocus
            />
          ) : (
            <span
              className="text-sm text-gray-800 cursor-pointer hover:opacity-80"
              onClick={() => setEditingField('dueDate')}
              title="Click to change"
            >
              {wp.dueDate ? formatDate(wp.dueDate) : <span className="text-gray-400 italic">No due date</span>}
            </span>
          )}
        </AttributeRow>

        {/* Estimated Hours */}
        <AttributeRow
          label="Estimated Hours"
          editingField={editingField}
          fieldKey="estimatedHours"
          onEdit={() => setEditingField('estimatedHours')}
          onCancel={() => setEditingField(null)}
        >
          {editingField === 'estimatedHours' ? (
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="0"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-200"
              autoFocus
              onBlur={(e) => {
                const val = e.target.value ? String(parseFloat(e.target.value)) : null
                void handleUpdate('estimatedHours', val)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value ? String(parseFloat((e.target as HTMLInputElement).value)) : null
                  void handleUpdate('estimatedHours', val)
                }
                if (e.key === 'Escape') setEditingField(null)
              }}
            />
          ) : (
            <span
              className="text-sm text-gray-800 cursor-pointer hover:opacity-80"
              onClick={() => setEditingField('estimatedHours')}
              title="Click to change"
            >
              {wp.estimatedHours != null ? `${wp.estimatedHours}h` : <span className="text-gray-400 italic">Not set</span>}
            </span>
          )}
        </AttributeRow>

        {/* Read-only: Created */}
        <AttributeRow label="Created" editingField={editingField} fieldKey="createdAt" onEdit={() => {}} onCancel={() => {}}>
          <span className="text-sm text-gray-500">
            {wp.createdAt ? formatDate(wp.createdAt) : '—'}
          </span>
        </AttributeRow>

        {/* Read-only: Updated */}
        <AttributeRow label="Updated" editingField={editingField} fieldKey="updatedAt" onEdit={() => {}} onCancel={() => {}}>
          <span className="text-sm text-gray-500">
            {wp.updatedAt ? formatDate(wp.updatedAt) : '—'}
          </span>
        </AttributeRow>
      </div>

      {/* Saving indicator */}
      {updateWorkPackage.isPending && (
        <div className="px-4 py-2 text-xs text-blue-600 border-t border-gray-100">
          Saving changes...
        </div>
      )}
    </div>
  )
}

// ─── AttributeRow ─────────────────────────────────────────────────────────────

interface AttributeRowProps {
  label: string
  editingField: string | null
  fieldKey: string
  onEdit: () => void
  onCancel: () => void
  children: React.ReactNode
}

function AttributeRow({ label, editingField, fieldKey, onEdit, onCancel, children }: AttributeRowProps) {
  const isEditing = editingField === fieldKey

  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50 group transition-colors">
      <span className="text-xs font-medium text-gray-500 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">
        {children}
      </div>
      {!isEditing && (
        <button
          onClick={onEdit}
          className="ml-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
          aria-label={`Edit ${label}`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateForInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  return colors[Math.abs(hash) % colors.length]
}

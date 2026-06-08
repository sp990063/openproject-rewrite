import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export interface MeetingAgendaItem {
  id: string
  meetingId: string
  title: string
  notes?: string | null
  duration?: number | null
  position: number
}

export interface CreateAgendaItemInput {
  title: string
  notes?: string
  duration?: number
}

interface MeetingAgendaTabProps {
  agendaItems?: MeetingAgendaItem[]
  canModify?: boolean
  onCreate?: (input: CreateAgendaItemInput) => Promise<void> | void
  onUpdate?: (
    agendaId: string,
    input: { title?: string; notes?: string | null; duration?: number | null; position?: number }
  ) => Promise<void> | void
  onDelete?: (agendaId: string) => Promise<void> | void
  className?: string
}

export function MeetingAgendaTab({
  agendaItems = [],
  canModify = false,
  onCreate,
  onUpdate,
  onDelete,
  className,
}: MeetingAgendaTabProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (agendaItems.length === 0 && !isAdding) {
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-500">No agenda items yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Add agenda items to structure your meeting
        </p>
        {canModify && onCreate && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="mt-4"
          >
            + Add Agenda Item
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Agenda Items ({agendaItems.length})
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Total duration: {agendaItems.reduce((sum, item) => sum + (item.duration || 0), 0)} min
          </span>
          {canModify && onCreate && !isAdding && (
            <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)}>
              + Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Add form */}
      {isAdding && onCreate && (
        <AgendaItemForm
          mode="create"
          onCancel={() => setIsAdding(false)}
          onSubmit={async (values) => {
            await onCreate({
              title: values.title,
              notes: values.notes,
              duration: values.duration,
            })
            setIsAdding(false)
          }}
        />
      )}

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
        {agendaItems.map((item, index) =>
          editingId === item.id && onUpdate ? (
            <div key={item.id} className="px-4 py-4 bg-gray-50">
              <AgendaItemForm
                mode="edit"
                initial={item}
                onCancel={() => setEditingId(null)}
                onSubmit={async (values) => {
                  await onUpdate(item.id, {
                    title: values.title,
                    notes: values.notes ?? null,
                    duration: values.duration ?? null,
                  })
                  setEditingId(null)
                }}
              />
            </div>
          ) : (
            <div key={item.id} className="px-4 py-4">
              <div className="flex items-start gap-4">
                {/* Position number */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-700">
                    {index + 1}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900">
                    {item.title}
                  </h4>

                  {/* Notes */}
                  {item.notes && (
                    <p className="mt-1 text-sm text-gray-500 whitespace-pre-wrap">
                      {item.notes}
                    </p>
                  )}

                  {/* Duration */}
                  {item.duration && (
                    <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {item.duration} minutes
                    </p>
                  )}
                </div>

                {/* Per-item actions */}
                {canModify && (
                  <div className="flex items-center gap-1">
                    {onUpdate && (
                      <button
                        type="button"
                        onClick={() => setEditingId(item.id)}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        aria-label={`Edit agenda item ${index + 1}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label={`Delete agenda item ${index + 1}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ─── Inline create / edit form ─────────────────────────────────────────────

interface AgendaItemFormProps {
  mode: 'create' | 'edit'
  initial?: { title: string; notes?: string | null; duration?: number | null }
  onSubmit: (values: { title: string; notes?: string; duration?: number }) => Promise<void> | void
  onCancel: () => void
}

function AgendaItemForm({ mode, initial, onSubmit, onCancel }: AgendaItemFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [durationStr, setDurationStr] = useState(
    initial?.duration != null ? String(initial.duration) : ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    const duration = durationStr ? parseInt(durationStr, 10) : undefined
    if (durationStr && (isNaN(duration!) || duration! <= 0)) {
      setError('Duration must be a positive number')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit({ title: title.trim(), notes: notes || undefined, duration })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Agenda item title"
        autoFocus
        error={error ?? undefined}
      />
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={durationStr}
          onChange={(e) => setDurationStr(e.target.value)}
          placeholder="Duration"
          min={1}
          className="w-24"
        />
        <span className="text-xs text-gray-400">min</span>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          isLoading={isSubmitting}
        >
          {mode === 'create' ? 'Add' : 'Save'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface AgendaItemInput {
  id?: string
  title: string
  notes?: string
  duration?: number // minutes
  position: number
}

interface AgendaEditorProps {
  items: AgendaItemInput[]
  onChange: (items: AgendaItemInput[]) => void
  readOnly?: boolean
  className?: string
}

export function AgendaEditor({
  items,
  onChange,
  readOnly = false,
  className,
}: AgendaEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const addItem = () => {
    const newItem: AgendaItemInput = {
      title: '',
      notes: '',
      duration: 15,
      position: items.length,
    }
    onChange([...items, newItem])
    setEditingId(newItem.position.toString())
  }

  const updateItem = (index: number, updates: Partial<AgendaItemInput>) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    )
    onChange(updated)
  }

  const removeItem = (index: number) => {
    const updated = items
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, position: i }))
    onChange(updated)
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === items.length - 1)
    )
      return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...items]
    const [removed] = updated.splice(index, 1)
    updated.splice(newIndex, 0, removed)
    onChange(updated.map((item, i) => ({ ...item, position: i })))
  }

  const totalDuration = items.reduce((sum, item) => sum + (item.duration || 0), 0)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          Agenda Items ({items.length})
          {totalDuration > 0 && (
            <span className="text-gray-400 ml-2">
              ({totalDuration} min total)
            </span>
          )}
        </h4>
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={addItem}>
            + Add Item
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          No agenda items yet
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id || index}
              className="border border-gray-200 rounded-lg p-3 bg-white"
            >
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-1 pt-1">
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                        className={cn(
                          'p-0.5 rounded hover:bg-gray-100 disabled:opacity-30',
                          !readOnly && index !== 0 && 'cursor-pointer'
                        )}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === items.length - 1}
                        className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 w-6">
                      {index + 1}.
                    </span>
                    {readOnly ? (
                      <span className="flex-1 font-medium text-gray-900">
                        {item.title || '(No title)'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateItem(index, { title: e.target.value })}
                        placeholder="Agenda item title"
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                    {item.duration && (
                      <Badge variant="default">{item.duration} min</Badge>
                    )}
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-2 ml-8">
                      <input
                        type="number"
                        value={item.duration || ''}
                        onChange={(e) =>
                          updateItem(index, {
                            duration: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                        placeholder="Duration"
                        min={1}
                        className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-400">minutes</span>
                      <textarea
                        value={item.notes || ''}
                        onChange={(e) => updateItem(index, { notes: e.target.value })}
                        placeholder="Notes (optional)"
                        rows={2}
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  )}

                  {!readOnly && item.notes && (
                    <div className="ml-8 text-xs text-gray-500 italic">
                      Notes: {item.notes}
                    </div>
                  )}
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import React, { useState, useRef, useCallback } from 'react'

interface DescriptionEditorProps {
  description: string
  onSave: (description: string) => Promise<void>
  isSaving?: boolean
}

export function DescriptionEditor({ description, onSave, isSaving }: DescriptionEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(description)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSave = useCallback(async () => {
    if (value === description) {
      setIsEditing(false)
      return
    }
    try {
      await onSave(value)
      setIsEditing(false)
    } catch {
      setValue(description)
    }
  }, [value, description, onSave])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setValue(description)
      setIsEditing(false)
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSave()
    }
  }

  // Auto-resize textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    // Auto-resize
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }

  if (!isEditing && !description) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full text-left text-gray-400 italic text-sm hover:text-gray-600 transition-colors"
      >
        + Add a description...
      </button>
    )
  }

  if (!isEditing) {
    return (
      <div
        className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap cursor-text group relative"
        onDoubleClick={() => setIsEditing(true)}
        title="Double-click to edit"
      >
        {description}
        {isSaving && (
          <span className="ml-2 text-xs text-gray-400 animate-pulse">Saving...</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className="w-full min-h-[100px] text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 resize-none"
        placeholder="Add a description..."
        autoFocus
        disabled={isSaving}
        rows={4}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Ctrl+Enter to save · Esc to cancel
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setValue(description); setIsEditing(false) }}
            className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 rounded"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

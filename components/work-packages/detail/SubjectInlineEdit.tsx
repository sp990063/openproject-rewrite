import React, { useState, useRef, useCallback } from 'react'

interface SubjectInlineEditProps {
  subject: string
  onSave: (subject: string) => Promise<void>
  isSaving?: boolean
}

export function SubjectInlineEdit({ subject, onSave, isSaving }: SubjectInlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(subject)
  const [isHovered, setIsHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSave = useCallback(async () => {
    if (value.trim() === subject) {
      setIsEditing(false)
      return
    }
    if (!value.trim()) {
      setValue(subject)
      setIsEditing(false)
      return
    }
    try {
      await onSave(value.trim())
      setIsEditing(false)
    } catch {
      setValue(subject)
    }
  }, [value, subject, onSave])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleSave()
    }
    if (e.key === 'Escape') {
      setValue(subject)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        autoFocus
        className="w-full text-2xl font-bold text-gray-900 border-2 border-blue-400 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100"
        disabled={isSaving}
      />
    )
  }

  return (
    <h1
      className={`text-2xl font-bold text-gray-900 cursor-text group relative ${
        isHovered ? 'bg-gray-100' : ''
      } rounded px-3 py-1 -mx-3 transition-colors`}
      onDoubleClick={() => setIsEditing(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Double-click to edit"
    >
      {subject}
      {isHovered && !isEditing && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs italic">
          double-click to edit
        </span>
      )}
    </h1>
  )
}

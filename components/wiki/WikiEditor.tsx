import React, { useState, useRef, useCallback } from 'react'

interface WikiEditorProps {
  initialTitle: string
  initialContent: string
  onSave: (data: { title: string; content: string }) => Promise<void>
  onCancel: () => void
  isSaving?: boolean
  isNew?: boolean
}

export function WikiEditor({
  initialTitle,
  initialContent,
  onSave,
  onCancel,
  isSaving = false,
  isNew = false,
}: WikiEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSave = useCallback(async () => {
    if (!title.trim()) return
    try {
      await onSave({ title: title.trim(), content })
    } catch {
      // Error handled by parent
    }
  }, [title, content, onSave])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      onCancel()
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSave()
    }
  }

  // Auto-resize textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      textareaRef.current?.focus()
    }
  }

  return (
    <div className="wiki-editor space-y-4">
      {/* Title input */}
      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder="Page title..."
          className="w-full text-2xl font-semibold text-gray-900 placeholder-gray-300 border-0 border-b-2 border-gray-200 focus:border-blue-500 focus:ring-0 pb-2 outline-none transition-colors"
          disabled={isSaving}
          autoFocus={isNew}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              !showPreview
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showPreview
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Preview
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !title.trim()}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content area */}
      {showPreview ? (
        <div className="min-h-[300px] p-4 border border-gray-200 rounded-lg bg-gray-50">
          {content ? (
            <pre className="whitespace-pre-wrap text-sm text-gray-700">{content}</pre>
          ) : (
            <p className="text-gray-400 italic">Nothing to preview</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write your wiki content in Markdown...

# Heading 1
## Heading 2

**Bold** and *italic* text

- List item
- Another item

[Link text](url)"
          className="w-full min-h-[300px] text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 resize-none font-mono"
          disabled={isSaving}
        />
      )}

      {/* Help text */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Markdown supported</span>
        <span>Ctrl+Enter to save · Esc to cancel</span>
      </div>
    </div>
  )
}

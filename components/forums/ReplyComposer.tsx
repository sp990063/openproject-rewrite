import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface ReplyComposerProps {
  onSubmit: (content: string) => Promise<void>
  onCancel?: () => void
  placeholder?: string
  isSubmitting?: boolean
}

export function ReplyComposer({
  onSubmit,
  onCancel,
  placeholder = 'Write your reply...',
  isSubmitting = false,
}: ReplyComposerProps) {
  const [content, setContent] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || isSubmitting) return

    await onSubmit(content.trim())
    setContent('')
    setIsFocused(false)
  }

  const handleCancel = () => {
    setContent('')
    setIsFocused(false)
    onCancel?.()
  }

  const showActions = isFocused || content.trim().length > 0

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className={`border rounded-lg transition-colors ${
          isFocused ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
        }`}
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          rows={3}
          disabled={isSubmitting}
          className="w-full px-4 py-3 resize-none rounded-lg disabled:bg-gray-50 text-sm"
          style={{ border: 'none', outline: 'none' }}
        />
      </div>

      {showActions && (
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-gray-400">
            Markdown formatting supported
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={!content.trim()}
            >
              Post Reply
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}
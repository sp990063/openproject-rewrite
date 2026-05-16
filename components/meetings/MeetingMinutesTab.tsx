import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'

interface MeetingMinutes {
  id: string
  meetingId: string
  content: string
  authorId: string
  createdAt: Date | string
  updatedAt: Date | string
  author?: { id: string; name: string; email?: string; avatarUrl?: string | null }
}

interface MeetingMinutesTabProps {
  minutes?: MeetingMinutes | null
  onSave?: (content: string) => Promise<void>
  isLoading?: boolean
  className?: string
}

export function MeetingMinutesTab({
  minutes,
  onSave,
  isLoading = false,
  className,
}: MeetingMinutesTabProps) {
  const [content, setContent] = useState(minutes?.content || '')
  const [isEditing, setIsEditing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    setHasChanges(e.target.value !== (minutes?.content || ''))
  }

  const handleSave = async () => {
    if (!onSave) return
    await onSave(content)
    setIsEditing(false)
    setHasChanges(false)
  }

  const handleCancel = () => {
    setContent(minutes?.content || '')
    setIsEditing(false)
    setHasChanges(false)
  }

  if (!minutes && !isEditing) {
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500">No minutes recorded yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Meeting minutes can be added after the meeting
        </p>
        {onSave && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="mt-4"
          >
            Add Minutes
          </Button>
        )}
      </div>
    )
  }

  const displayContent = isEditing ? content : (minutes?.content || '')

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Meeting Minutes</h3>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              {hasChanges && (
                <span className="text-sm text-amber-600">Unsaved changes</span>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                isLoading={isLoading}
                disabled={!hasChanges && !minutes}
              >
                Save Minutes
              </Button>
            </>
          ) : (
            onSave && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Edit Minutes
              </Button>
            )
          )}
        </div>
      </div>

      {/* Meta info */}
      {minutes && !isEditing && (
        <div className="flex items-center gap-2 text-sm text-gray-500 pb-4 border-b border-gray-200">
          <span>Last updated by</span>
          <span className="font-medium">{minutes.author?.name || 'Unknown'}</span>
          <span>•</span>
          <span>{formatDateTime(minutes.updatedAt)}</span>
        </div>
      )}

      {/* Minutes content */}
      {isEditing ? (
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Enter meeting minutes..."
          rows={15}
          className={cn(
            'w-full px-3 py-2 border rounded-lg text-gray-900 placeholder-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'resize-none'
          )}
        />
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
            {displayContent || 'No content'}
          </pre>
        </div>
      )}
    </div>
  )
}

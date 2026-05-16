import React from 'react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface MeetingDetailHeaderProps {
  meeting: {
    id: string
    title: string
    startTime: Date | string
    endTime: Date | string
    location?: string | null
    author?: { id: string; name: string; email?: string; avatarUrl?: string | null }
    project?: { id: string; name: string; identifier: string }
  }
  onEdit?: () => void
  onDelete?: () => void
  isLoading?: boolean
}

export function MeetingDetailHeader({
  meeting,
  onEdit,
  onDelete,
  isLoading = false,
}: MeetingDetailHeaderProps) {
  const startTime = new Date(meeting.startTime)
  const endTime = new Date(meeting.endTime)

  const getDurationMinutes = () => {
    return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
  }

  const duration = getDurationMinutes()
  const isPast = startTime < new Date()

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href={`/projects/${meeting.project?.identifier || meeting.project?.id}/meetings`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Meetings
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>

          {/* Meta info */}
          <div className="mt-4 space-y-2">
            {/* Date/Time */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">{formatDateTime(meeting.startTime)}</span>
              <span className="text-gray-400">—</span>
              <span>{formatDateTime(meeting.endTime)}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${isPast ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                {duration} min
              </span>
            </div>

            {/* Location */}
            {meeting.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-5 h-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{meeting.location}</span>
              </div>
            )}

            {/* Author */}
            {meeting.author && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-5 h-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Organized by</span>
                <span className="font-medium">{meeting.author.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onEdit}
                isLoading={isLoading}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={onDelete}
                isLoading={isLoading}
                className="hover:text-red-700 hover:border-red-300"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

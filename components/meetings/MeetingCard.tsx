import React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ParticipantGroup } from './ParticipantBadge'

interface AttendeeUser {
  id: string
  name: string
  email?: string
  avatarUrl?: string | null
}

interface MeetingAttendee {
  id: string
  userId: string
  response: 'none' | 'accepted' | 'declined'
  comment?: string | null
  user?: AttendeeUser
}

interface MeetingCardProps {
  meeting: {
    id: string
    title: string
    startTime: Date | string
    endTime: Date | string
    location?: string | null
    author?: { id: string; name: string; email?: string; avatarUrl?: string | null }
    project?: { id: string; name: string; identifier: string }
    attendees?: MeetingAttendee[]
    _count?: { agenda: number }
  }
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

export function MeetingCard({
  meeting,
  onClick,
  onEdit,
  onDelete,
  className,
}: MeetingCardProps) {
  const startTime = new Date(meeting.startTime)
  const endTime = new Date(meeting.endTime)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getDurationMinutes = () => {
    return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
  }

  const isPast = startTime < new Date()
  const duration = getDurationMinutes()

  return (
    <div
      className={cn(
        'border border-gray-200 rounded-lg p-4 bg-white hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer',
        isPast && 'opacity-75',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {meeting.title}
          </h3>

          {/* Date/Time */}
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              {formatDate(startTime)} · {formatTime(startTime)} - {formatTime(endTime)}
            </span>
            <Badge variant={isPast ? 'default' : 'info'}>
              {duration} min
            </Badge>
          </div>

          {/* Location */}
          {meeting.location && (
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{meeting.location}</span>
            </div>
          )}

          {/* Author */}
          {meeting.author && (
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <span>Organized by</span>
              <span className="font-medium text-gray-600">{meeting.author.name}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3">
            {/* Attendees */}
            {meeting.attendees && meeting.attendees.length > 0 && (
              <ParticipantGroup
                attendees={meeting.attendees}
                maxDisplay={5}
                showResponse
                size="sm"
              />
            )}

            {/* Agenda count */}
            {meeting._count && meeting._count.agenda > 0 && (
              <Badge variant="default">
                {meeting._count.agenda} agenda item{meeting._count.agenda !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        {(onEdit || onDelete) && (
          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="px-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

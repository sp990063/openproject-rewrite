import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { MeetingCard } from './MeetingCard'
import { MeetingForm } from './MeetingForm'
import type { User } from '@/types'

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

interface MeetingListItem {
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

interface MeetingListProps {
  meetings: MeetingListItem[]
  isLoading?: boolean
  projectId?: string
  projectMembers?: Array<{ id: string; name: string; email?: string; avatarUrl?: string | null }>
  onCreateMeeting?: (data: {
    title: string
    startTime: string
    endTime: string
    location: string
    attendeeIds: string[]
  }) => Promise<void>
  onEditMeeting?: (meeting: MeetingListItem) => void
  onDeleteMeeting?: (meetingId: string) => void
  onMeetingClick?: (meeting: MeetingListItem) => void
  className?: string
}

export function MeetingList({
  meetings,
  isLoading = false,
  projectId,
  projectMembers = [],
  onCreateMeeting,
  onEditMeeting,
  onDeleteMeeting,
  onMeetingClick,
  className,
}: MeetingListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all')

  const now = new Date()

  const filteredMeetings = meetings.filter((meeting) => {
    const startTime = new Date(meeting.startTime)
    if (filter === 'upcoming') return startTime >= now
    if (filter === 'past') return startTime < now
    return true
  })

  const upcomingCount = meetings.filter(
    (m) => new Date(m.startTime) >= now
  ).length
  const pastCount = meetings.filter(
    (m) => new Date(m.startTime) < now
  ).length

  const handleCreateMeeting = async (data: {
    title: string
    startTime: string
    endTime: string
    location: string
    attendeeIds: string[]
  }) => {
    await onCreateMeeting?.(data)
    setShowCreateForm(false)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Meetings</h2>
          <p className="text-sm text-gray-500">
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
            {upcomingCount > 0 && ` · ${upcomingCount} upcoming`}
          </p>
        </div>
        {onCreateMeeting && (
          <Button onClick={() => setShowCreateForm(true)}>
            + Schedule Meeting
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            filter === 'all'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          All ({meetings.length})
        </button>
        <button
          onClick={() => setFilter('upcoming')}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            filter === 'upcoming'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Upcoming ({upcomingCount})
        </button>
        <button
          onClick={() => setFilter('past')}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            filter === 'past'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Past ({pastCount})
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredMeetings.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto w-12 h-12 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900">No meetings</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'all'
              ? 'Get started by scheduling your first meeting'
              : `No ${filter} meetings to display`}
          </p>
          {filter === 'all' && onCreateMeeting && (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setShowCreateForm(true)}
            >
              Schedule Meeting
            </Button>
          )}
        </div>
      )}

      {/* Meeting list */}
      {!isLoading && filteredMeetings.length > 0 && (
        <div className="space-y-3">
          {filteredMeetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onClick={() => onMeetingClick?.(meeting)}
              onEdit={
                onEditMeeting
                  ? () => onEditMeeting(meeting)
                  : undefined
              }
              onDelete={
                onDeleteMeeting
                  ? () => onDeleteMeeting(meeting.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Create form modal */}
      {onCreateMeeting && (
        <MeetingForm
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          onSubmit={handleCreateMeeting}
          projectMembers={projectMembers}
          mode="create"
        />
      )}
    </div>
  )
}

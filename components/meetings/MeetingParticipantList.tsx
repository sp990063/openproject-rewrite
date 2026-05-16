import React from 'react'
import { cn } from '@/lib/utils'

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

interface MeetingParticipantListProps {
  attendees?: MeetingAttendee[]
  className?: string
}

export function MeetingParticipantList({
  attendees = [],
  className,
}: MeetingParticipantListProps) {
  const attending = attendees.filter((a) => a.response === 'accepted')
  const declined = attendees.filter((a) => a.response === 'declined')
  const pending = attendees.filter((a) => a.response === 'none')

  const getStatusBadge = (response: 'none' | 'accepted' | 'declined') => {
    switch (response) {
      case 'accepted':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Attending
          </span>
        )
      case 'declined':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            Declined
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            Pending
          </span>
        )
    }
  }

  if (attendees.length === 0) {
    return (
      <div className={cn('text-sm text-gray-500 italic', className)}>
        No participants invited
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className="font-medium">
          {attendees.length} participant{attendees.length !== 1 ? 's' : ''}
        </span>
        {attending.length > 0 && (
          <span className="text-green-600">{attending.length} attending</span>
        )}
        {declined.length > 0 && (
          <span className="text-red-600">{declined.length} declined</span>
        )}
        {pending.length > 0 && (
          <span className="text-gray-400">{pending.length} pending</span>
        )}
      </div>

      {/* Attendee List */}
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
        {attendees.map((attendee) => (
          <div
            key={attendee.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              {attendee.user?.avatarUrl ? (
                <img
                  src={attendee.user.avatarUrl}
                  alt={attendee.user.name}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-gray-500">
                    {attendee.user?.name?.charAt(0) ?? '?'}
                  </span>
                </div>
              )}

              {/* Name & Email */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {attendee.user?.name ?? 'Unknown'}
                </p>
                {attendee.user?.email && (
                  <p className="text-xs text-gray-500 truncate">
                    {attendee.user.email}
                  </p>
                )}
              </div>
            </div>

            {/* Status */}
            {getStatusBadge(attendee.response)}
          </div>
        ))}
      </div>
    </div>
  )
}

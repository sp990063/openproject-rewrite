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

interface ParticipantBadgeProps {
  attendee: MeetingAttendee
  showResponse?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ParticipantBadge({
  attendee,
  showResponse = false,
  size = 'md',
  className,
}: ParticipantBadgeProps) {
  const user = attendee.user
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  const responseConfig = {
    none: { label: 'Pending', variant: 'bg-gray-100 text-gray-600' as const },
    accepted: { label: 'Accepted', variant: 'bg-green-100 text-green-700' as const },
    declined: { label: 'Declined', variant: 'bg-red-100 text-red-700' as const },
  }

  const response = responseConfig[attendee.response] || responseConfig.none
  const sizeClasses = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'

  return (
    <div className={cn('relative group', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-medium',
          sizeClasses,
          user?.avatarUrl ? 'bg-transparent' : 'bg-blue-100 text-blue-700'
        )}
        title={user?.name || 'Unknown'}
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Tooltip with name */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {user?.name || 'Unknown'}
      </div>

      {/* Response badge */}
      {showResponse && (
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
            attendee.response === 'accepted' && 'bg-green-500',
            attendee.response === 'declined' && 'bg-red-500',
            attendee.response === 'none' && 'bg-yellow-500'
          )}
          title={response.label}
        />
      )}
    </div>
  )
}

interface ParticipantGroupProps {
  attendees: MeetingAttendee[]
  maxDisplay?: number
  showResponse?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ParticipantGroup({
  attendees,
  maxDisplay = 5,
  showResponse = false,
  size = 'md',
  className,
}: ParticipantGroupProps) {
  const displayed = attendees.slice(0, maxDisplay)
  const remaining = attendees.length - maxDisplay

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {displayed.map((attendee) => (
        <ParticipantBadge
          key={attendee.id}
          attendee={attendee}
          showResponse={showResponse}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'rounded-full flex items-center justify-center bg-gray-100 text-gray-600 font-medium ring-2 ring-white',
            size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
          )}
          title={`${remaining} more`}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}

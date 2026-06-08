import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'
import { parseErrorResponse, MeetingApiError } from './useMeetingMutations'

export interface MeetingAgendaItem {
  id: string
  meetingId: string
  title: string
  notes?: string | null
  duration?: number | null
  position: number
}

export interface MeetingMinutes {
  id: string
  meetingId: string
  content: string
  authorId: string
  createdAt: Date | string
  updatedAt: Date | string
  author?: {
    id: string
    name: string
    email?: string
    avatarUrl?: string | null
  }
}

export interface MeetingAttendee {
  id: string
  userId: string
  response: 'none' | 'accepted' | 'declined'
  comment?: string | null
  user?: {
    id: string
    name: string
    email?: string
    avatarUrl?: string | null
  }
}

export interface Meeting {
  id: string
  projectId: string
  title: string
  startTime: Date
  endTime: Date
  location?: string | null
  authorId: string
  createdAt: Date
  updatedAt: Date
  author?: {
    id: string
    name: string
    email?: string
    avatarUrl?: string | null
  }
  project?: {
    id: string
    name: string
    identifier: string
  }
  attendees?: MeetingAttendee[]
  agenda?: MeetingAgendaItem[]
  minutes?: MeetingMinutes | null
  _count?: { agenda: number }
}

async function fetchMeetings(
  projectId: string,
  options?: { startAfter?: string; endBefore?: string }
): Promise<Meeting[]> {
  const params = new URLSearchParams()
  if (options?.startAfter) params.set('startAfter', options.startAfter)
  if (options?.endBefore) params.set('endBefore', options.endBefore)

  const url = `/api/projects/${projectId}/meetings${params.toString() ? '?' + params.toString() : ''}`
  const res = await fetch(url)
  if (!res.ok) throw await parseErrorResponse(res)
  return res.json()
}

async function fetchMeeting(projectId: string, id: string): Promise<Meeting> {
  const res = await fetch(`/api/projects/${projectId}/meetings/${id}`)
  if (!res.ok) throw await parseErrorResponse(res)
  return res.json()
}

export function useMeetings(
  projectId: string | undefined,
  options?: { startAfter?: string; endBefore?: string }
) {
  return useQuery({
    queryKey: queryKeys.meetings(projectId ?? '', options),
    queryFn: () => fetchMeetings(projectId!, options),
    enabled: !!projectId,
  })
}

export function useMeeting(projectId: string | undefined, meetingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.meeting(meetingId ?? ''),
    queryFn: () => fetchMeeting(projectId!, meetingId!),
    enabled: !!projectId && !!meetingId,
  })
}

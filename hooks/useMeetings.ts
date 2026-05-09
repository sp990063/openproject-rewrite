import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

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
  _count?: { agenda: number }
}

async function fetchMeetings(
  projectId: string,
  options?: { startAfter?: string; endBefore?: string }
): Promise<Meeting[]> {
  const params = new URLSearchParams({ projectId })
  if (options?.startAfter) params.set('startAfter', options.startAfter)
  if (options?.endBefore) params.set('endBefore', options.endBefore)

  const res = await fetch(`/api/meetings?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch meetings')
  return res.json()
}

async function fetchMeeting(id: string): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${id}`)
  if (!res.ok) throw new Error('Failed to fetch meeting')
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

export function useMeeting(meetingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.meeting(meetingId ?? ''),
    queryFn: () => fetchMeeting(meetingId!),
    enabled: !!meetingId,
  })
}

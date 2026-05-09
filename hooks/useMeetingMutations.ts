import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

export interface CreateMeetingInput {
  projectId: string
  title: string
  startTime: string
  endTime: string
  location?: string
  authorId: string
  attendeeIds?: string[]
}

export interface UpdateMeetingInput {
  title?: string
  startTime?: string
  endTime?: string
  location?: string | null
}

export interface SetAttendeesInput {
  attendees: Array<{
    userId: string
    response?: 'none' | 'accepted' | 'declined'
    comment?: string
  }>
}

// ─── Meeting CRUD ─────────────────────────────────────────────────────────────

async function createMeeting(data: CreateMeetingInput) {
  const res = await fetch('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create meeting' }))
    throw new Error(error.error || 'Failed to create meeting')
  }
  return res.json()
}

async function updateMeeting(id: string, data: UpdateMeetingInput) {
  const res = await fetch(`/api/meetings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to update meeting' }))
    throw new Error(error.error || 'Failed to update meeting')
  }
  return res.json()
}

async function deleteMeeting(id: string) {
  const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to delete meeting' }))
    throw new Error(error.error || 'Failed to delete meeting')
  }
}

export function useCreateMeeting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createMeeting,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meetings(variables.projectId) })
    },
  })
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMeetingInput }) =>
      updateMeeting(id, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meeting(variables.id) })
      void queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
  })
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteMeeting,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
  })
}

// ─── Attendees ───────────────────────────────────────────────────────────────

async function setAttendees(meetingId: string, data: SetAttendeesInput) {
  const res = await fetch(`/api/meetings/${meetingId}/attendees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to set attendees' }))
    throw new Error(error.error || 'Failed to set attendees')
  }
  return res.json()
}

export function useSetAttendees() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ meetingId, data }: { meetingId: string; data: SetAttendeesInput }) =>
      setAttendees(meetingId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meeting(variables.meetingId) })
    },
  })
}

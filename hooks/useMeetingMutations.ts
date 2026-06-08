import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

export interface CreateMeetingInput {
  projectId: string
  title: string
  startTime: string
  endTime: string
  location?: string
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

// ─── Uniform error envelope parser (Phase 7 Sprint B-2) ────────────────────
// After Sprint B-2, all meeting routes return the standard
// `{success:false, error:{code, message, details?}}` envelope from
// withRoute HOF. The previous ad-hoc `{error: 'STRING'}` shape is gone.
export interface ApiErrorEnvelope {
  code: string
  message: string
  details?: unknown
}

export class MeetingApiError extends Error {
  public readonly code: string
  public readonly status: number
  public readonly details?: unknown

  constructor(status: number, envelope: ApiErrorEnvelope) {
    super(envelope.message)
    this.name = 'MeetingApiError'
    this.code = envelope.code
    this.status = status
    this.details = envelope.details
  }
}

export async function parseErrorResponse(res: Response): Promise<MeetingApiError> {
  let envelope: ApiErrorEnvelope
  try {
    const body = await res.json()
    // withRoute HOF envelope: { success: false, error: { code, message, details } }
    if (body?.error?.code && body?.error?.message) {
      envelope = body.error
    } else if (typeof body?.error === 'string') {
      // Legacy fallback (defense in depth — should not occur after Sprint B-2)
      envelope = { code: 'UNKNOWN', message: body.error }
    } else {
      envelope = { code: 'UNKNOWN', message: `HTTP ${res.status}` }
    }
  } catch {
    envelope = { code: 'UNKNOWN', message: `HTTP ${res.status}` }
  }
  return new MeetingApiError(res.status, envelope)
}

// ─── Meeting CRUD ─────────────────────────────────────────────────────────────

async function createMeeting(data: CreateMeetingInput) {
  // Sprint B-2: authorId is no longer sent — server derives from session.
  const res = await fetch('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await parseErrorResponse(res)
  return res.json()
}

async function updateMeeting(id: string, data: UpdateMeetingInput) {
  const res = await fetch(`/api/meetings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await parseErrorResponse(res)
  return res.json()
}

async function deleteMeeting(id: string) {
  const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
  if (!res.ok) throw await parseErrorResponse(res)
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
  if (!res.ok) throw await parseErrorResponse(res)
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

// ─── Agenda Items (Phase 7 Sprint B-2) ──────────────────────────────────────

export interface CreateAgendaItemInput {
  title: string
  notes?: string
  duration?: number
  position?: number
}

export interface UpdateAgendaItemInput {
  title?: string
  notes?: string | null
  duration?: number | null
  position?: number
}

async function createAgendaItem(
  meetingId: string,
  data: CreateAgendaItemInput
) {
  const res = await fetch(`/api/meetings/${meetingId}/agenda`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await parseErrorResponse(res)
  return res.json()
}

async function updateAgendaItem(
  meetingId: string,
  agendaId: string,
  data: UpdateAgendaItemInput
) {
  const res = await fetch(`/api/meetings/${meetingId}/agenda/${agendaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await parseErrorResponse(res)
  return res.json()
}

async function deleteAgendaItem(meetingId: string, agendaId: string) {
  const res = await fetch(`/api/meetings/${meetingId}/agenda/${agendaId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw await parseErrorResponse(res)
}

export function useCreateAgendaItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ meetingId, data }: { meetingId: string; data: CreateAgendaItemInput }) =>
      createAgendaItem(meetingId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meeting(variables.meetingId) })
    },
  })
}

export function useUpdateAgendaItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      meetingId,
      agendaId,
      data,
    }: {
      meetingId: string
      agendaId: string
      data: UpdateAgendaItemInput
    }) => updateAgendaItem(meetingId, agendaId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meeting(variables.meetingId) })
    },
  })
}

export function useDeleteAgendaItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ meetingId, agendaId }: { meetingId: string; agendaId: string }) =>
      deleteAgendaItem(meetingId, agendaId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meeting(variables.meetingId) })
    },
  })
}

// ─── Minutes (Phase 7 Sprint B-2) ───────────────────────────────────────────

export interface SaveMinutesInput {
  content: string
}

async function createMinutes(meetingId: string, data: SaveMinutesInput) {
  const res = await fetch(`/api/meetings/${meetingId}/minutes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await parseErrorResponse(res)
  return res.json()
}

async function updateMinutes(meetingId: string, data: SaveMinutesInput) {
  const res = await fetch(`/api/meetings/${meetingId}/minutes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await parseErrorResponse(res)
  return res.json()
}

export function useCreateMinutes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ meetingId, data }: { meetingId: string; data: SaveMinutesInput }) =>
      createMinutes(meetingId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meeting(variables.meetingId) })
    },
  })
}

export function useUpdateMinutes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ meetingId, data }: { meetingId: string; data: SaveMinutesInput }) =>
      updateMinutes(meetingId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.meeting(variables.meetingId) })
    },
  })
}

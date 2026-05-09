// ─── Phase 4: Meeting Types ────────────────────────────────────────────────────

export interface Meeting {
  id: string
  projectId: string
  title: string
  startTime: Date
  endTime: Date
  location: string | null
  authorId: string
  createdAt: Date
  updatedAt: Date
  project?: Pick<Project, 'id' | 'name' | 'identifier'>
  author?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
  attendees?: MeetingAttendee[]
  agenda?: MeetingAgendaItem[]
  minutes?: MeetingMinutes | null
}

export interface MeetingAttendee {
  id: string
  meetingId: string
  userId: string
  response: 'none' | 'accepted' | 'declined'
  comment: string | null
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
  meeting?: Meeting
}

export interface MeetingAgendaItem {
  id: string
  meetingId: string
  title: string
  notes: string | null
  duration: number | null // minutes
  position: number
  meeting?: Meeting
}

export interface MeetingMinutes {
  id: string
  meetingId: string
  content: string
  authorId: string
  createdAt: Date
  updatedAt: Date
  meeting?: Meeting
  author?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateMeetingInput {
  projectId: string
  title: string
  startTime: string // ISO date string
  endTime: string   // ISO date string
  location?: string
  authorId: string
  attendees?: string[] // user IDs
}

export interface UpdateMeetingInput {
  title?: string
  startTime?: string
  endTime?: string
  location?: string | null
}

export interface SetMeetingAttendeesInput {
  attendees: Array<{
    userId: string
    response?: 'none' | 'accepted' | 'declined'
    comment?: string
  }>
}

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

export interface CreateMinutesInput {
  content: string
  authorId: string
}

export interface UpdateMinutesInput {
  content: string
}

// ─── Search result types ──────────────────────────────────────────────────────

export interface SearchResult {
  id: string
  type: 'wiki' | 'forum' | 'document' | 'meeting' | 'work_package'
  title: string
  summary: string | null
  projectId: string
  projectName: string
  url: string
  updatedAt: Date
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
}

// ─── Shared picks ────────────────────────────────────────────────────────────

type User = {
  id: string
  name: string
  email?: string
  avatarUrl?: string | null
}

type Project = {
  id: string
  name: string
  identifier: string
}

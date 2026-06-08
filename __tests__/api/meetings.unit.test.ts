/**
 * Phase 7 Sprint B-2 — Unit tests for the cross-meeting routes
 * (pages/api/meetings/*) RBAC hardening.
 *
 * Each route now wraps its handler in `withRoute` HOF + project
 * membership check via `assertMeeting*ProjectMembership`. These tests
 * exercise the 3 critical paths that the previous (pre-Sprint-B-2)
 * direct handler had open holes on:
 *
 *   - 401:  no session (withRoute HOF's auth gate)
 *   - 403:  authenticated but not a project member
 *           (assertMeeting* helpers)
 *   - 404:  meeting/agenda/minutes/attendee not found
 *           (also via the helpers)
 *
 * Mocking strategy: `vi.hoisted` creates a stable object of vi.fn()
 * mocks that the factory closes over. This is required because
 * vi.mock factory bodies are hoisted to the top of the file — if
 * they call vi.fn() inline, the test-time mockResolvedValue calls
 * are lost (each handler import re-invokes the factory).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// ─── Stable mock handles (vi.hoisted runs before vi.mock) ──────────────────
const mocks = vi.hoisted(() => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  const projectFindUnique = vi.fn()
  const memberFindUnique = vi.fn()
  const meetingFindUnique = vi.fn()
  const meetingFindMany = vi.fn()
  const meetingCreate = vi.fn()
  const meetingUpdate = vi.fn()
  const meetingDelete = vi.fn()
  const agendaFindMany = vi.fn()
  const agendaFindUnique = vi.fn()
  const agendaCreate = vi.fn()
  const agendaUpdate = vi.fn()
  const agendaDelete = vi.fn()
  const minutesFindUnique = vi.fn()
  const minutesCreate = vi.fn()
  const minutesUpdate = vi.fn()
  const attendeeFindUnique = vi.fn()
  const attendeeDeleteMany = vi.fn()
  const attendeeCreateMany = vi.fn()
  return {
    c,
    projectFindUnique,
    memberFindUnique,
    meetingFindUnique,
    meetingFindMany,
    meetingCreate,
    meetingUpdate,
    meetingDelete,
    agendaFindMany,
    agendaFindUnique,
    agendaCreate,
    agendaUpdate,
    agendaDelete,
    minutesFindUnique,
    minutesCreate,
    minutesUpdate,
    attendeeFindUnique,
    attendeeDeleteMany,
    attendeeCreateMany,
  }
})

// ─── Mock Redis + Ratelimit (withRoute HOF loads these at request time) ───
vi.mock('@upstash/redis', () => {
  const mockRedis = { get: vi.fn(), set: vi.fn(), del: vi.fn() }
  return { Redis: { fromEnv: () => mockRedis } }
})

vi.mock('@upstash/ratelimit', () => {
  const MockRatelimitClass = function (_opts: { redis: unknown; limiter: unknown }) {
    return { limit: vi.fn(() => Promise.resolve({ success: true })) }
  } as unknown as { new (opts: { redis: unknown; limiter: unknown }): unknown; slidingWindow: unknown }
  ;(MockRatelimitClass as unknown as { slidingWindow: unknown }).slidingWindow = vi.fn(
    (_a: number, _b: string) => MockRatelimitClass
  )
  return { Ratelimit: MockRatelimitClass }
})

// ─── Mock Prisma (closes over `mocks` handles from vi.hoisted) ────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    member: { findUnique: mocks.memberFindUnique },
    meeting: {
      findUnique: mocks.meetingFindUnique,
      findMany: mocks.meetingFindMany,
      create: mocks.meetingCreate,
      update: mocks.meetingUpdate,
      delete: mocks.meetingDelete,
    },
    meetingAgendaItem: {
      findMany: mocks.agendaFindMany,
      findUnique: mocks.agendaFindUnique,
      create: mocks.agendaCreate,
      update: mocks.agendaUpdate,
      delete: mocks.agendaDelete,
    },
    meetingMinutes: {
      findUnique: mocks.minutesFindUnique,
      create: mocks.minutesCreate,
      update: mocks.minutesUpdate,
    },
    meetingAttendee: {
      findUnique: mocks.attendeeFindUnique,
      deleteMany: mocks.attendeeDeleteMany,
      createMany: mocks.attendeeCreateMany,
    },
  },
}))

// ─── Mock meeting-conflict helper (return no conflict by default) ─────────
vi.mock('@/lib/meeting-conflict', () => ({
  checkMeetingConflict: vi.fn().mockResolvedValue({
    hasConflict: false,
    conflictingMeetings: [],
  }),
}))

// ─── Mock session — controllable per-test ─────────────────────────────────
let mockSession: { user: { id: string; isSystemAdmin: boolean } } | null = {
  user: { id: mocks.c(3), isSystemAdmin: false },
}

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession)),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

// ─── Import routes AFTER mocks ────────────────────────────────────────────
import meetingIdHandler from '@/pages/api/meetings/[id]'
import meetingAgendaHandler from '@/pages/api/meetings/[id]/agenda'
import meetingAgendaItemHandler from '@/pages/api/meetings/[id]/agenda/[agendaId]'
import meetingMinutesHandler from '@/pages/api/meetings/[id]/minutes'
import meetingAttendeesHandler from '@/pages/api/meetings/[id]/attendees'
import meetingsListHandler from '@/pages/api/meetings'

const c = mocks.c

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeMocks(
  method: string,
  body?: Record<string, unknown>,
  query?: Record<string, string | string[]>
) {
  const mockReq = {
    method,
    body: body ?? {},
    query: query ?? {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as NextApiRequest

  let statusCode = 200
  let jsonData: unknown = null
  const mockRes = {
    statusCode: 200,
    status: (code: number) => {
      statusCode = code
      return mockRes
    },
    json: (data: unknown) => {
      jsonData = data
      return mockRes
    },
    setHeader: () => mockRes,
    end: vi.fn(),
  } as unknown as NextApiResponse & { end: ReturnType<typeof vi.fn> }

  return {
    req: mockReq,
    res: mockRes,
    getStatus: () => statusCode,
    getJson: () => jsonData,
  }
}

/** Populate the happy-path mocks so any finder returns a known entity. */
function seedHappyPathEntities() {
  // Project lookup
  mocks.projectFindUnique.mockResolvedValue({
    id: c(1),
    name: 'Test Project',
    identifier: 'test-project',
  })
  // Membership lookup — non-member by default
  mocks.memberFindUnique.mockResolvedValue(null)
  // Meetings
  mocks.meetingFindUnique.mockResolvedValue({
    id: c(2),
    projectId: c(1),
    title: 'Test Meeting',
    startTime: new Date('2026-06-15T10:00:00Z'),
    endTime: new Date('2026-06-15T11:00:00Z'),
    location: 'Room 1',
    authorId: c(3),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  })
  mocks.meetingFindMany.mockResolvedValue([])
  mocks.meetingCreate.mockResolvedValue({ id: c(2) })
  mocks.meetingUpdate.mockResolvedValue({ id: c(2) })
  // Agenda
  mocks.agendaFindMany.mockResolvedValue([])
  mocks.agendaFindUnique.mockResolvedValue({
    id: c(4),
    meetingId: c(2),
    meeting: { projectId: c(1) },
    title: 'Test Agenda Item',
    notes: 'Notes',
    duration: 15,
    position: 0,
  })
  mocks.agendaCreate.mockResolvedValue({ id: c(4) })
  mocks.agendaUpdate.mockResolvedValue({ id: c(4) })
  // Minutes
  mocks.minutesFindUnique.mockResolvedValue({
    id: c(5),
    meetingId: c(2),
    content: 'Test minutes',
    authorId: c(3),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  })
  mocks.minutesCreate.mockResolvedValue({ id: c(5) })
  // Attendees
  mocks.attendeeDeleteMany.mockResolvedValue({ count: 1 })
  mocks.attendeeCreateMany.mockResolvedValue({ count: 1 })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: c(3), isSystemAdmin: false } }
  seedHappyPathEntities()
})

// ============================================================
// 401 — no session: withRoute HOF must block before any handler
// ============================================================
describe('401 — unauthenticated requests are blocked by withRoute HOF', () => {
  it('GET /api/meetings/[id]', async () => {
    mockSession = null
    const m = makeMocks('GET', {}, { id: c(2) })
    await meetingIdHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    })
  })

  it('PATCH /api/meetings/[id]', async () => {
    mockSession = null
    const m = makeMocks('PATCH', { title: 'x' }, { id: c(2) })
    await meetingIdHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('DELETE /api/meetings/[id]', async () => {
    mockSession = null
    const m = makeMocks('DELETE', undefined, { id: c(2) })
    await meetingIdHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('GET /api/meetings/[id]/agenda', async () => {
    mockSession = null
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingAgendaHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('POST /api/meetings/[id]/agenda', async () => {
    mockSession = null
    const m = makeMocks('POST', { title: 'x' }, { id: c(2) })
    await meetingAgendaHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('PATCH /api/meetings/[id]/agenda/[agendaId]', async () => {
    mockSession = null
    const m = makeMocks('PATCH', { title: 'x' }, { id: c(2), agendaId: c(4) })
    await meetingAgendaItemHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('DELETE /api/meetings/[id]/agenda/[agendaId]', async () => {
    mockSession = null
    const m = makeMocks('DELETE', undefined, { id: c(2), agendaId: c(4) })
    await meetingAgendaItemHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('GET /api/meetings/[id]/minutes', async () => {
    mockSession = null
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingMinutesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('POST /api/meetings/[id]/minutes', async () => {
    mockSession = null
    const m = makeMocks('POST', { content: 'x' }, { id: c(2) })
    await meetingMinutesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('PATCH /api/meetings/[id]/minutes', async () => {
    mockSession = null
    const m = makeMocks('PATCH', { content: 'x' }, { id: c(2) })
    await meetingMinutesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('POST /api/meetings/[id]/attendees', async () => {
    mockSession = null
    const m = makeMocks('POST', { attendees: [] }, { id: c(2) })
    await meetingAttendeesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('GET /api/meetings', async () => {
    mockSession = null
    const m = makeMocks('GET')
    await meetingsListHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('POST /api/meetings', async () => {
    mockSession = null
    const m = makeMocks('POST', {
      projectId: c(1),
      title: 'x',
      startTime: '2026-06-15T10:00:00Z',
      endTime: '2026-06-15T11:00:00Z',
    })
    await meetingsListHandler(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })
})

// ============================================================
// 403 — authenticated but not a project member
// assertMeeting* helpers must deny
// ============================================================
describe('403 — non-member is denied by assertMeeting* helpers', () => {
  it('GET /api/meetings/[id] returns 403', async () => {
    // seedHappyPathEntities already leaves memberFindUnique → null
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingIdHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    })
  })

  it('PATCH /api/meetings/[id] returns 403', async () => {
    const m = makeMocks('PATCH', { title: 'x' }, { id: c(2) })
    await meetingIdHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('DELETE /api/meetings/[id] returns 403', async () => {
    const m = makeMocks('DELETE', undefined, { id: c(2) })
    await meetingIdHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('GET /api/meetings/[id]/agenda returns 403', async () => {
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingAgendaHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('POST /api/meetings/[id]/agenda returns 403', async () => {
    const m = makeMocks('POST', { title: 'x' }, { id: c(2) })
    await meetingAgendaHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('PATCH /api/meetings/[id]/agenda/[agendaId] returns 403', async () => {
    const m = makeMocks('PATCH', { title: 'x' }, { id: c(2), agendaId: c(4) })
    await meetingAgendaItemHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('GET /api/meetings/[id]/minutes returns 403', async () => {
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingMinutesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('POST /api/meetings/[id]/minutes returns 403', async () => {
    const m = makeMocks('POST', { content: 'x' }, { id: c(2) })
    await meetingMinutesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('POST /api/meetings/[id]/attendees returns 403', async () => {
    const m = makeMocks('POST', { attendees: [] }, { id: c(2) })
    await meetingAttendeesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('POST /api/meetings with non-member projectId returns 403', async () => {
    const m = makeMocks('POST', {
      projectId: c(1),
      title: 'x',
      startTime: '2026-06-15T10:00:00Z',
      endTime: '2026-06-15T11:00:00Z',
    })
    await meetingsListHandler(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })
})

// ============================================================
// 403 — system admin bypass
// isSystemAdmin=true skips the membership check
// ============================================================
describe('system admin bypass', () => {
  it('GET /api/meetings/[id] returns 200 for system admin even with no membership', async () => {
    mockSession = { user: { id: c(99), isSystemAdmin: true } }
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingIdHandler(m.req, m.res)
    expect(m.getStatus()).toBe(200)
  })

  it('GET /api/meetings/[id]/minutes returns 200 for system admin', async () => {
    mockSession = { user: { id: c(99), isSystemAdmin: true } }
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingMinutesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(200)
  })
})

// ============================================================
// 404 — meeting/agenda/minutes/attendee not found
// ============================================================
describe('404 — entity not found', () => {
  it('GET /api/meetings/[id] when meeting does not exist', async () => {
    // System admin to bypass 403 and reach the 404 check
    mockSession = { user: { id: c(99), isSystemAdmin: true } }
    mocks.meetingFindUnique.mockResolvedValue(null)
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingIdHandler(m.req, m.res)
    expect(m.getStatus()).toBe(404)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'MEETING_NOT_FOUND' },
    })
  })

  it('PATCH /api/meetings/[id]/agenda/[agendaId] when agenda item not found', async () => {
    mockSession = { user: { id: c(99), isSystemAdmin: true } }
    mocks.agendaFindUnique.mockResolvedValue(null)
    const m = makeMocks('PATCH', { title: 'x' }, { id: c(2), agendaId: c(4) })
    await meetingAgendaItemHandler(m.req, m.res)
    expect(m.getStatus()).toBe(404)
  })

  it('GET /api/meetings/[id]/minutes when minutes do not exist', async () => {
    mockSession = { user: { id: c(99), isSystemAdmin: true } }
    mocks.minutesFindUnique.mockResolvedValue(null)
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingMinutesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(404)
  })
})

// ============================================================
// 200 — member happy paths
// ============================================================
describe('200 — member happy paths return expected envelopes', () => {
  beforeEach(() => {
    mocks.memberFindUnique.mockResolvedValue({ id: c(8) })
  })

  it('GET /api/meetings/[id] returns meeting', async () => {
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingIdHandler(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    const data = m.getJson() as { id: string }
    expect(data.id).toBe(c(2))
  })

  it('GET /api/meetings/[id]/agenda returns items array', async () => {
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingAgendaHandler(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    const data = m.getJson() as unknown[]
    expect(Array.isArray(data)).toBe(true)
  })

  it('GET /api/meetings/[id]/minutes returns minutes', async () => {
    const m = makeMocks('GET', undefined, { id: c(2) })
    await meetingMinutesHandler(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    const data = m.getJson() as { id: string }
    expect(data.id).toBe(c(5))
  })
})

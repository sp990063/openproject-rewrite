/**
 * Phase 3 Sprint 3 — Unit tests for the `time-entries/[id]/approve`
 * and `time-entries/[id]/reject` routes.
 *
 * Critical findings addressed:
 *   - API-78  — anyone authenticated could approve any time entry
 *   - API-80  — same gap on reject.ts (API-191 is the same finding
 *               duplicated by the reviewer; same fix applies)
 *
 * Strategy:
 *   - Use `vi.hoisted` for stable mock handles (required because
 *     vi.mock factories are hoisted before module imports).
 *   - Mock `getServerSession` from next-auth to return either a
 *     real user, an admin, or null (401 path).
 *   - Mock `@/lib/prisma` with just the methods the routes touch.
 *   - Mock `@upstash/redis` and `@upstash/ratelimit` so withRoute's
 *     rate-limit guard passes (test env also bypasses via NODE_ENV).
 *   - Drive the route directly and assert status codes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// ─── Stable mock handles ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  return {
    c,
    timeEntryFindUnique: vi.fn(),
    timeEntryUpdate: vi.fn(),
    projectFindUnique: vi.fn(),
    memberFindUnique: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    timeEntry: {
      findUnique: mocks.timeEntryFindUnique,
      update: mocks.timeEntryUpdate,
    },
    project: { findUnique: mocks.projectFindUnique },
    member: { findUnique: mocks.memberFindUnique },
  },
}))

let mockSession: { user: { id: string; isSystemAdmin?: boolean } } | null = {
  user: { id: 'u1' },
}
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession)),
}))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
  isSystemAdmin: vi.fn(() => Promise.resolve(false)),
}))

vi.mock('@upstash/redis', () => {
  const mockRedis = { get: vi.fn(), set: vi.fn(), del: vi.fn() }
  return { Redis: { fromEnv: () => mockRedis } }
})
vi.mock('@upstash/ratelimit', () => {
  const MockRatelimit = vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  }))
  return { Ratelimit: MockRatelimit }
})

// ─── Import after mocks ──────────────────────────────────────────────────
import approveRoute from '@/pages/api/time-entries/[id]/approve'
import rejectRoute from '@/pages/api/time-entries/[id]/reject'

const { c } = mocks

beforeEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: 'u1' } }
})

function makeMocks(
  method: string,
  query?: Record<string, string | string[]>,
  body?: unknown
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

// Helper: projectId for the entry's work package
const PROJECT_ID = c(1)
const ENTRY_ID = c(2)

// ════════════════════════════════════════════════════════════════════════
//  APPROVE
// ════════════════════════════════════════════════════════════════════════
describe('POST /api/time-entries/[id]/approve — RBAC (API-78)', () => {
  it('401 when unauthenticated', async () => {
    mockSession = null
    const m = makeMocks('POST', { id: ENTRY_ID })
    await approveRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('403 when user is not a project member (formerly allowed)', async () => {
    mocks.timeEntryFindUnique.mockResolvedValue({
      id: ENTRY_ID,
      status: 'submitted',
      workPackage: { projectId: PROJECT_ID },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: PROJECT_ID })
    mocks.memberFindUnique.mockResolvedValue(null) // not a member

    const m = makeMocks('POST', { id: ENTRY_ID })
    await approveRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    })
    // The crucial assertion: the update MUST NOT have happened.
    expect(mocks.timeEntryUpdate).not.toHaveBeenCalled()
  })

  it('200 when user is a project member', async () => {
    mocks.timeEntryFindUnique.mockResolvedValue({
      id: ENTRY_ID,
      status: 'submitted',
      workPackage: { projectId: PROJECT_ID },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: PROJECT_ID })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    mocks.timeEntryUpdate.mockResolvedValue({
      id: ENTRY_ID,
      status: 'approved',
      spentOn: new Date(),
      approvedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      workPackage: { id: 'wp1', subject: 's', estimatedHours: null },
      user: { id: 'author1', name: 'Author' },
      approver: { id: 'u1', name: 'U1' },
    })

    const m = makeMocks('POST', { id: ENTRY_ID })
    await approveRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(mocks.timeEntryUpdate).toHaveBeenCalledWith({
      where: { id: ENTRY_ID },
      data: expect.objectContaining({
        status: 'approved',
        approvedBy: 'u1',
      }),
      include: expect.any(Object),
    })
  })

  it('200 when system admin bypasses membership', async () => {
    mockSession = { user: { id: 'admin1', isSystemAdmin: true } }
    mocks.timeEntryFindUnique.mockResolvedValue({
      id: ENTRY_ID,
      status: 'submitted',
      workPackage: { projectId: PROJECT_ID },
    })
    mocks.timeEntryUpdate.mockResolvedValue({
      id: ENTRY_ID,
      status: 'approved',
      spentOn: new Date(),
      approvedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      workPackage: { id: 'wp1', subject: 's', estimatedHours: null },
      user: { id: 'author1', name: 'Author' },
      approver: { id: 'admin1', name: 'Admin' },
    })

    const m = makeMocks('POST', { id: ENTRY_ID })
    await approveRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })

  it('404 when time entry does not exist', async () => {
    mocks.timeEntryFindUnique.mockResolvedValue(null)

    const m = makeMocks('POST', { id: ENTRY_ID })
    await approveRoute(m.req, m.res)
    expect(m.getStatus()).toBe(404)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'TIME_ENTRY_NOT_FOUND' },
    })
  })

  it('400 when entry is not in submitted status', async () => {
    mocks.timeEntryFindUnique.mockResolvedValue({
      id: ENTRY_ID,
      status: 'pending',
      workPackage: { projectId: PROJECT_ID },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: PROJECT_ID })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })

    const m = makeMocks('POST', { id: ENTRY_ID })
    await approveRoute(m.req, m.res)
    expect(m.getStatus()).toBe(400)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'INVALID_STATUS' },
    })
  })
})

// ════════════════════════════════════════════════════════════════════════
//  REJECT
// ════════════════════════════════════════════════════════════════════════
describe('POST /api/time-entries/[id]/reject — RBAC (API-80 / API-191)', () => {
  it('401 when unauthenticated', async () => {
    mockSession = null
    const m = makeMocks('POST', { id: ENTRY_ID }, { reason: 'no' })
    await rejectRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('403 when user is not a project member (formerly allowed)', async () => {
    mocks.timeEntryFindUnique.mockResolvedValue({
      id: ENTRY_ID,
      status: 'submitted',
      workPackage: { projectId: PROJECT_ID },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: PROJECT_ID })
    mocks.memberFindUnique.mockResolvedValue(null)

    const m = makeMocks('POST', { id: ENTRY_ID }, { reason: 'wrong hours' })
    await rejectRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
    expect(mocks.timeEntryUpdate).not.toHaveBeenCalled()
  })

  it('200 with reason when user is a project member', async () => {
    mocks.timeEntryFindUnique.mockResolvedValue({
      id: ENTRY_ID,
      status: 'submitted',
      workPackage: { projectId: PROJECT_ID },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: PROJECT_ID })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    mocks.timeEntryUpdate.mockResolvedValue({
      id: ENTRY_ID,
      status: 'rejected',
      spentOn: new Date(),
      approvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      workPackage: { id: 'wp1', subject: 's', estimatedHours: null },
      user: { id: 'author1', name: 'Author' },
      approver: null,
    })

    const m = makeMocks('POST', { id: ENTRY_ID }, { reason: 'wrong project' })
    await rejectRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(mocks.timeEntryUpdate).toHaveBeenCalledWith({
      where: { id: ENTRY_ID },
      data: expect.objectContaining({
        status: 'rejected',
        rejectReason: 'wrong project',
      }),
      include: expect.any(Object),
    })
  })

  it('200 with system admin bypasses membership', async () => {
    mockSession = { user: { id: 'admin1', isSystemAdmin: true } }
    mocks.timeEntryFindUnique.mockResolvedValue({
      id: ENTRY_ID,
      status: 'submitted',
      workPackage: { projectId: PROJECT_ID },
    })
    mocks.timeEntryUpdate.mockResolvedValue({
      id: ENTRY_ID,
      status: 'rejected',
      spentOn: new Date(),
      approvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      workPackage: { id: 'wp1', subject: 's', estimatedHours: null },
      user: { id: 'author1', name: 'Author' },
      approver: null,
    })

    const m = makeMocks('POST', { id: ENTRY_ID })
    await rejectRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })

  it('400 on validation error (reason too long)', async () => {
    mocks.timeEntryFindUnique.mockResolvedValue({
      id: ENTRY_ID,
      status: 'submitted',
      workPackage: { projectId: PROJECT_ID },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: PROJECT_ID })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })

    const longReason = 'x'.repeat(2001)
    const m = makeMocks('POST', { id: ENTRY_ID }, { reason: longReason })
    await rejectRoute(m.req, m.res)
    expect(m.getStatus()).toBe(400)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    })
  })
})
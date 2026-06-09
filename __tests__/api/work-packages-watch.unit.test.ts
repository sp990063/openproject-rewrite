/**
 * Phase 7 Sprint B-3.4 — Unit tests for the work-package watch route
 * RBAC hardening + the `assertWorkPackageProjectMembership` helper.
 *
 * The watch route previously let any logged-in user watch/unwatch any
 * work package by ID (enumeration + privacy issue). It now uses
 * `withRoute` HOF + `assertWorkPackageProjectMembership` helper.
 *
 * Mocking strategy: `vi.hoisted` creates a stable object of vi.fn()
 * mocks that the factory closes over. This is required because
 * vi.mock factory bodies are hoisted to the top of the file — if
 * they call vi.fn() inline, the test-time mockResolvedValue calls
 * are lost (each handler import re-invokes the factory).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// ─── Stable mock handles ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  return {
    c,
    projectFindUnique: vi.fn(),
    memberFindUnique: vi.fn(),
    workPackageFindUnique: vi.fn(),
    workPackageUpdate: vi.fn(),
    userFindUnique: vi.fn(),
    notificationCreate: vi.fn(),
    broadcastNotification: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    member: { findUnique: mocks.memberFindUnique },
    workPackage: {
      findUnique: mocks.workPackageFindUnique,
      update: mocks.workPackageUpdate,
    },
    user: { findUnique: mocks.userFindUnique },
    notification: { create: mocks.notificationCreate },
  },
}))

vi.mock('@/lib/notifications/realtime', () => ({
  broadcastNotification: mocks.broadcastNotification,
}))

let mockSession: { user: { id: string; isSystemAdmin?: boolean } } | null = {
  user: { id: mocks.c(3) },
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
import { assertWorkPackageProjectMembership } from '@/lib/auth/project'
import { ApiError } from '@/lib/api/withRoute'
import watchRoute from '@/pages/api/work-packages/[id]/watch'

const { c } = mocks

function makeMocks(
  method: string,
  query?: Record<string, string | string[]>
) {
  const mockReq = {
    method,
    body: {},
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

beforeEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: c(3) } }
})

// ════════════════════════════════════════════════════════════════════════
//  HELPER DIRECT TESTS
// ════════════════════════════════════════════════════════════════════════
describe('assertWorkPackageProjectMembership helper', () => {
  it('throws 400 on missing workPackageId', async () => {
    await expect(
      assertWorkPackageProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('throws 404 WORK_PACKAGE_NOT_FOUND when WP does not exist', async () => {
    mocks.workPackageFindUnique.mockResolvedValue(null)
    await expect(
      assertWorkPackageProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WORK_PACKAGE_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertWorkPackageProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertWorkPackageProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
  })

  it('system admin bypasses both lookups', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(1) })
    const result = await assertWorkPackageProjectMembership(c(2), 'admin1', true)
    expect(result).toBe(c(1))
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════
//  ROUTE INTEGRATION TESTS
// ════════════════════════════════════════════════════════════════════════
describe('401 — unauthenticated requests blocked by withRoute HOF', () => {
  beforeEach(() => {
    mockSession = null
  })

  it('GET /api/work-packages/[id]/watch', async () => {
    const m = makeMocks('GET', { id: c(2) })
    await watchRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('POST /api/work-packages/[id]/watch', async () => {
    const m = makeMocks('POST', { id: c(2) })
    await watchRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('DELETE /api/work-packages/[id]/watch', async () => {
    const m = makeMocks('DELETE', { id: c(2) })
    await watchRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })
})

describe('403 — authenticated non-member is denied', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
  })

  it('GET /api/work-packages/[id]/watch — non-member', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(1) })
    const m = makeMocks('GET', { id: c(2) })
    await watchRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('POST /api/work-packages/[id]/watch — non-member', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(1) })
    const m = makeMocks('POST', { id: c(2) })
    await watchRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })
})

describe('404 — work package not found', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
  })

  it('GET /api/work-packages/[id]/watch — WP not found', async () => {
    mocks.workPackageFindUnique.mockResolvedValue(null)
    const m = makeMocks('GET', { id: c(2) })
    await watchRoute(m.req, m.res)
    expect(m.getStatus()).toBe(404)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'WORK_PACKAGE_NOT_FOUND' },
    })
  })
})

describe('200 — happy path with project member', () => {
  beforeEach(() => {
    mockSession = { user: { id: c(3) } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
  })

  it('GET returns isWatching + count', async () => {
    // helper: project lookup
    mocks.workPackageFindUnique
      .mockResolvedValueOnce({ projectId: c(1) }) // helper
      .mockResolvedValueOnce({                      // handler: WP detail
        id: c(2),
        watchers: [{ id: c(3) }],
      })
    const m = makeMocks('GET', { id: c(2) })
    await watchRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({
      success: true,
      data: { isWatching: true, count: 1 },
    })
  })

  it('POST adds user to watchers (assignee = self, no notification)', async () => {
    mocks.workPackageFindUnique
      .mockResolvedValueOnce({ projectId: c(1) })              // helper
      .mockResolvedValueOnce({                                   // handler: full WP
        id: c(2),
        subject: 'Test',
        projectId: c(1),
        project: { name: 'P' },
        assigneeId: c(3),  // self
      })
      .mockResolvedValueOnce({                                   // count lookup
        id: c(2),
        watchers: [{ id: c(3) }],
      })
    const m = makeMocks('POST', { id: c(2) })
    await watchRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({
      success: true,
      data: { isWatching: true, count: 1 },
    })
    // No notification when actor is the assignee
    expect(mocks.notificationCreate).not.toHaveBeenCalled()
  })
})

describe('200 — system admin bypasses project membership check', () => {
  it('GET /api/work-packages/[id]/watch with isSystemAdmin=true', async () => {
    mockSession = { user: { id: 'admin1', isSystemAdmin: true } }
    mocks.workPackageFindUnique
      .mockResolvedValueOnce({ projectId: c(1) })
      .mockResolvedValueOnce({ id: c(2), watchers: [] })
    const m = makeMocks('GET', { id: c(2) })
    await watchRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})

/**
 * Phase 7 Sprint B-3.3 — Unit tests for the announcements routes
 * RBAC hardening.
 *
 * Routes now wrap their handler in `withRoute` HOF. Each route's
 * admin-only check is kept in the handler body (because
 * `isSystemAdmin()` is async and the withRoute rbac callback is sync).
 *
 * Tests exercise the 4 critical paths:
 *   - 401:  no session (withRoute HOF's auth gate)
 *   - 403:  authenticated but not a system admin
 *   - 200:  authenticated admin can CRUD
 *   - 404:  announcement not found (for [id] routes)
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
  return {
    c,
    announcementFindMany: vi.fn(),
    announcementCreate: vi.fn(),
    announcementUpdate: vi.fn(),
    announcementDelete: vi.fn(),
    isSystemAdmin: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    announcement: {
      findMany: mocks.announcementFindMany,
      create: mocks.announcementCreate,
      update: mocks.announcementUpdate,
      delete: mocks.announcementDelete,
    },
  },
}))

let mockSession: { user: { id: string; isSystemAdmin?: boolean } } | null = {
  user: { id: mocks.c(3) },
}

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => Promise.resolve(mockSession)),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
  isSystemAdmin: mocks.isSystemAdmin,
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

// ─── Import routes AFTER mocks ────────────────────────────────────────────
import announcementsIndexRoute from '@/pages/api/announcements'
import announcementIdRoute from '@/pages/api/announcements/[id]'
import announcementDismissRoute from '@/pages/api/announcements/dismiss'

const { c } = mocks

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

beforeEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: c(3) } }
})

// ════════════════════════════════════════════════════════════════════════
//  401 — unauthenticated (withRoute HOF gate)
// ════════════════════════════════════════════════════════════════════════
describe('401 — unauthenticated requests are blocked by withRoute HOF', () => {
  beforeEach(() => {
    mockSession = null
  })

  it('GET /api/announcements', async () => {
    const m = makeMocks('GET')
    await announcementsIndexRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    })
  })

  it('POST /api/announcements', async () => {
    const m = makeMocks('POST', { content: 'x' })
    await announcementsIndexRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('PUT /api/announcements/[id]', async () => {
    const m = makeMocks('PUT', { content: 'x' }, { id: c(2) })
    await announcementIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('DELETE /api/announcements/[id]', async () => {
    const m = makeMocks('DELETE', undefined, { id: c(2) })
    await announcementIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('POST /api/announcements/dismiss', async () => {
    const m = makeMocks('POST')
    await announcementDismissRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })
})

// ════════════════════════════════════════════════════════════════════════
//  403 — non-admin
// ════════════════════════════════════════════════════════════════════════
describe('403 — authenticated non-admin is denied write access', () => {
  beforeEach(() => {
    mockSession = { user: { id: c(3) } }
    mocks.isSystemAdmin.mockResolvedValue(false)
  })

  it('POST /api/announcements — non-admin', async () => {
    const m = makeMocks('POST', { content: 'x' })
    await announcementsIndexRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    })
  })

  it('PUT /api/announcements/[id] — non-admin', async () => {
    const m = makeMocks('PUT', { content: 'x' }, { id: c(2) })
    await announcementIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('DELETE /api/announcements/[id] — non-admin', async () => {
    const m = makeMocks('DELETE', undefined, { id: c(2) })
    await announcementIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })
})

// ════════════════════════════════════════════════════════════════════════
//  200 — admin can do everything
// ════════════════════════════════════════════════════════════════════════
describe('200 — admin can list / create / update / delete', () => {
  beforeEach(() => {
    mockSession = { user: { id: c(3) } }
    mocks.isSystemAdmin.mockResolvedValue(true)
  })

  it('GET /api/announcements returns the active list', async () => {
    mocks.announcementFindMany.mockResolvedValue([{ id: c(2), content: 'a' }])
    const m = makeMocks('GET')
    await announcementsIndexRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({
      success: true,
      data: [{ id: c(2) }],
    })
  })

  it('POST /api/announcements creates a new announcement', async () => {
    mocks.announcementCreate.mockResolvedValue({ id: c(2), content: 'x' })
    const m = makeMocks('POST', { content: 'x', type: 'info' })
    await announcementsIndexRoute(m.req, m.res)
    expect(m.getStatus()).toBe(201)
    expect(m.getJson()).toMatchObject({
      success: true,
      data: { id: c(2) },
    })
  })

  it('PUT /api/announcements/[id] updates the announcement', async () => {
    mocks.announcementUpdate.mockResolvedValue({ id: c(2), content: 'updated' })
    const m = makeMocks('PUT', { content: 'updated' }, { id: c(2) })
    await announcementIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({
      success: true,
      data: { id: c(2) },
    })
  })

  it('DELETE /api/announcements/[id] deletes the announcement', async () => {
    mocks.announcementDelete.mockResolvedValue({ id: c(2) })
    const m = makeMocks('DELETE', undefined, { id: c(2) })
    await announcementIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(204)
  })

  it('POST /api/announcements/dismiss returns 200', async () => {
    const m = makeMocks('POST')
    await announcementDismissRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({
      success: true,
      data: { dismissed: true },
    })
  })
})

// ════════════════════════════════════════════════════════════════════════
//  404 — announcement not found on update / delete
// ════════════════════════════════════════════════════════════════════════
describe('404 — announcement not found on PUT / DELETE', () => {
  beforeEach(() => {
    mockSession = { user: { id: c(3) } }
    mocks.isSystemAdmin.mockResolvedValue(true)
  })

  it('PUT /api/announcements/[id] — not found', async () => {
    mocks.announcementUpdate.mockRejectedValue(new Error('Record to update not found.'))
    const m = makeMocks('PUT', { content: 'x' }, { id: c(2) })
    await announcementIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(404)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'ANNOUNCEMENT_NOT_FOUND' },
    })
  })

  it('DELETE /api/announcements/[id] — not found', async () => {
    mocks.announcementDelete.mockRejectedValue(new Error('Record to delete does not exist.'))
    const m = makeMocks('DELETE', undefined, { id: c(2) })
    await announcementIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(404)
  })
})

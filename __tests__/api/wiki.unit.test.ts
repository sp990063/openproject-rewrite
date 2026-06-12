/**
 * Phase 7 Sprint B-3.1 — Unit tests for the wiki routes RBAC hardening
 * + the `assertWikiPage*ProjectMembership` helpers.
 *
 * Covers:
 *   - Direct helper tests (400/404/403/happy/admin)
 *   - Route integration tests via withRoute HOF + helper
 *     (401/403/404/happy/admin)
 *
 * Mocking strategy: `vi.hoisted` creates a stable object of vi.fn()
 * mocks that the factory closes over. The `mockSession` let is declared
 * before the `vi.mock('next-auth')` call (matches the B-2 meetings test
 * pattern). All mocks are reset in beforeEach.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// ─── Stable mock handles (vi.hoisted runs before vi.mock) ──────────────────
const mocks = vi.hoisted(() => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  const projectFindUnique = vi.fn()
  const memberFindUnique = vi.fn()
  const wikiPageFindUnique = vi.fn()
  const wikiPageFindFirst = vi.fn()
  const wikiPageFindMany = vi.fn()
  const wikiPageUpdate = vi.fn()
  const wikiPageDelete = vi.fn()
  const wikiPageVersionFindFirst = vi.fn()
  const wikiPageVersionFindMany = vi.fn()
  const wikiPageVersionCreate = vi.fn()
  return {
    c,
    projectFindUnique,
    memberFindUnique,
    wikiPageFindUnique,
    wikiPageFindFirst,
    wikiPageFindMany,
    wikiPageUpdate,
    wikiPageDelete,
    wikiPageVersionFindFirst,
    wikiPageVersionFindMany,
    wikiPageVersionCreate,
  }
})

// ─── Mock session (controllable per test) ─────────────────────────────────
let mockSession: { user: { id: string; isSystemAdmin?: boolean } } | null = {
  user: { id: mocks.c(3) },
}

// ─── Mock next-auth / next route dependencies BEFORE importing routes ─────
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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    member: { findUnique: mocks.memberFindUnique },
    wikiPage: {
      findUnique: mocks.wikiPageFindUnique,
      findFirst: mocks.wikiPageFindFirst,
      findMany: mocks.wikiPageFindMany,
      update: mocks.wikiPageUpdate,
      delete: mocks.wikiPageDelete,
    },
    wikiPageVersion: {
      findFirst: mocks.wikiPageVersionFindFirst,
      findMany: mocks.wikiPageVersionFindMany,
      create: mocks.wikiPageVersionCreate,
    },
  },
}))

// ─── Import helpers + routes AFTER mocks ──────────────────────────────────
import {
  assertWikiPageProjectMembership,
  assertWikiPageBySlugProjectMembership,
} from '@/lib/auth/project'
import { ApiError } from '@/lib/api/withRoute'
import wikiIdRoute from '@/pages/api/wiki/[id]'
import wikiRestoreRoute from '@/pages/api/wiki/[id]/restore'
import wikiVersionsRoute from '@/pages/api/wiki/[id]/versions'
import wikiBySlugRoute from '@/pages/api/wiki/by-slug'

const { c } = mocks

// ─── Test helpers ─────────────────────────────────────────────────────────
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
//  DIRECT HELPER TESTS
// ════════════════════════════════════════════════════════════════════════
describe('assertWikiPageProjectMembership helper', () => {
  it('throws 400 ApiError on missing wikiPageId', async () => {
    await expect(
      assertWikiPageProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('throws 404 WIKI_PAGE_NOT_FOUND when page does not exist', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WIKI_PAGE_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path (member exists)', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertWikiPageProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
    expect(mocks.wikiPageFindUnique).toHaveBeenCalledWith({
      where: { id: c(2) },
      select: { projectId: true },
    })
  })

  it('system admin bypasses both project and member lookups', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(1) })
    const result = await assertWikiPageProjectMembership(c(2), 'admin1', true)
    expect(result).toBe(c(1))
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })

  it('throws 404 PROJECT_NOT_FOUND when page belongs to non-existent project', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'PROJECT_NOT_FOUND' })
  })
})

describe('assertWikiPageBySlugProjectMembership helper', () => {
  it('throws 400 ApiError on missing slug', async () => {
    await expect(
      assertWikiPageBySlugProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('throws 404 WIKI_PAGE_NOT_FOUND when no page matches slug', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue(null)
    await expect(
      assertWikiPageBySlugProjectMembership('missing', 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WIKI_PAGE_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue({ id: c(2), projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageBySlugProjectMembership('test-page', 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns {projectId, pageId} on happy path', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue({ id: c(2), projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertWikiPageBySlugProjectMembership('test-page', 'u1', false)
    expect(result).toEqual({ projectId: c(1), pageId: c(2) })
  })

  it('system admin bypasses project and member lookups', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue({ id: c(2), projectId: c(1) })
    const result = await assertWikiPageBySlugProjectMembership('admin-slug', 'admin1', true)
    expect(result).toEqual({ projectId: c(1), pageId: c(2) })
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════
//  ROUTE INTEGRATION TESTS (via withRoute HOF + assertWikiPage*)
// ════════════════════════════════════════════════════════════════════════
describe('401 — unauthenticated route requests are blocked by withRoute HOF', () => {
  beforeEach(() => {
    mockSession = null
  })

  it('GET /api/wiki/[id]', async () => {
    const m = makeMocks('GET', undefined, { id: c(2) })
    await wikiIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
    expect(m.getJson()).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } })
  })

  it('PATCH /api/wiki/[id]', async () => {
    const m = makeMocks('PATCH', { title: 'x' }, { id: c(2) })
    await wikiIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('DELETE /api/wiki/[id]', async () => {
    const m = makeMocks('DELETE', undefined, { id: c(2) })
    await wikiIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('POST /api/wiki/[id]/restore', async () => {
    const m = makeMocks('POST', { version: 1 }, { id: c(2) })
    await wikiRestoreRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('GET /api/wiki/[id]/versions', async () => {
    const m = makeMocks('GET', undefined, { id: c(2) })
    await wikiVersionsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('GET /api/wiki/by-slug?slug=...', async () => {
    const m = makeMocks('GET', undefined, { slug: 'test', projectId: c(1) })
    await wikiBySlugRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })
})

describe('403 — authenticated non-member is denied', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
  })

  it('GET /api/wiki/[id]', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(1) })
    const m = makeMocks('GET', undefined, { id: c(2) })
    await wikiIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('GET /api/wiki/by-slug?slug=...', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue({ id: c(2), projectId: c(1) })
    const m = makeMocks('GET', undefined, { slug: 'test', projectId: c(1) })
    await wikiBySlugRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })
})

describe('404 — wiki page or slug not found', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
  })

  it('GET /api/wiki/[id] — page not found', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue(null)
    const m = makeMocks('GET', undefined, { id: c(2) })
    await wikiIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(404)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'WIKI_PAGE_NOT_FOUND' },
    })
  })

  it('GET /api/wiki/by-slug?slug=missing — slug not found', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue(null)
    const m = makeMocks('GET', undefined, { slug: 'missing', projectId: c(1) })
    await wikiBySlugRoute(m.req, m.res)
    expect(m.getStatus()).toBe(404)
  })
})

describe('200 — happy path with project member', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
  })

  it('GET /api/wiki/[id]', async () => {
    const wikiPage = {
      id: c(2),
      projectId: c(1),
      title: 'Test',
      slug: 'test',
      content: 'hello',
      authorId: 'u1',
      version: 1,
      parentId: null,
    }
    mocks.wikiPageFindUnique
      .mockResolvedValueOnce({ projectId: c(1) }) // helper
      .mockResolvedValueOnce(wikiPage)              // handler detail
    const m = makeMocks('GET', undefined, { id: c(2) })
    await wikiIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({ success: true, data: wikiPage })
  })

  it('GET /api/wiki/by-slug?slug=...', async () => {
    mocks.wikiPageFindFirst
      .mockResolvedValueOnce({ id: c(2), projectId: c(1) })
      .mockResolvedValueOnce({
        id: c(2),
        projectId: c(1),
        title: 'Test',
        slug: 'test',
        content: '',
        authorId: 'u1',
        version: 1,
        parentId: null,
        author: { id: 'u1', name: 'U', email: 'u@x', avatarUrl: null },
        parent: null,
        children: [],
        project: { id: c(1), name: 'P', identifier: 'p' },
      })
    const m = makeMocks('GET', undefined, { slug: 'test', projectId: c(1) })
    await wikiBySlugRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
  })
})

describe('200 — system admin bypasses project membership check', () => {
  it('GET /api/wiki/[id] with isSystemAdmin=true', async () => {
    mockSession = { user: { id: 'admin1', isSystemAdmin: true } }
    const wikiPage = {
      id: c(2), projectId: c(1), title: 'Admin', slug: 'admin',
      content: '', authorId: 'u1', version: 1, parentId: null,
    }
    mocks.wikiPageFindUnique
      .mockResolvedValueOnce({ projectId: c(1) })
      .mockResolvedValueOnce(wikiPage)
    const m = makeMocks('GET', undefined, { id: c(2) })
    await wikiIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})

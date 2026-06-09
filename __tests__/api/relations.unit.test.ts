/**
 * Phase 7 Sprint B-4 — Unit tests for the `assertRelationProjectMembership`
 * helper.
 *
 * The relations route previously let any logged-in user read or modify
 * any work-package relation in the system by ID. The new helper
 * resolves `relationId → relation.from.projectId` and asserts the
 * caller is a member of that project (or a system admin).
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
    workPackageRelationFindUnique: vi.fn(),
    workPackageRelationUpdate: vi.fn(),
    workPackageRelationDelete: vi.fn(),
    projectFindUnique: vi.fn(),
    memberFindUnique: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workPackageRelation: {
      findUnique: mocks.workPackageRelationFindUnique,
      update: mocks.workPackageRelationUpdate,
      delete: mocks.workPackageRelationDelete,
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
import { assertRelationProjectMembership } from '@/lib/auth/project'
import { ApiError } from '@/lib/api/withRoute'
import relationsRoute from '@/pages/api/relations/[id]'

const { c } = mocks

beforeEach(() => {
  vi.clearAllMocks()
})

// ════════════════════════════════════════════════════════════════════════
//  HELPER DIRECT TESTS
// ════════════════════════════════════════════════════════════════════════
describe('assertRelationProjectMembership helper', () => {
  it('throws 400 BAD_REQUEST on missing relationId', async () => {
    await expect(
      assertRelationProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
    await expect(
      assertRelationProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 RELATION_NOT_FOUND when relation does not exist', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue(null)
    await expect(
      assertRelationProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'RELATION_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(1) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertRelationProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(1) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertRelationProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
  })

  it('system admin bypasses project + member lookups', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(1) },
    })
    const result = await assertRelationProjectMembership(c(2), 'admin1', true)
    expect(result).toBe(c(1))
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })

  it('reads projectId from `from` (not `to`) for symmetric relations', async () => {
    // Two work packages in different projects would be a data-integrity
    // violation (relations are intra-project), but the helper must
    // use the `from` side regardless of the `to` payload.
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(1) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertRelationProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
  })
})

// ════════════════════════════════════════════════════════════════════════
//  ROUTE INTEGRATION TESTS
// ════════════════════════════════════════════════════════════════════════

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

describe('401 — unauthenticated requests blocked by withRoute HOF', () => {
  beforeEach(() => {
    mockSession = null
  })

  it('GET /api/relations/[id]', async () => {
    const m = makeMocks('GET', { id: c(2) })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('PATCH /api/relations/[id]', async () => {
    const m = makeMocks('PATCH', { id: c(2) }, { relationType: 'blocks' })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('DELETE /api/relations/[id]', async () => {
    const m = makeMocks('DELETE', { id: c(2) })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })
})

describe('403 — authenticated non-member is denied', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(1) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
  })

  it('GET /api/relations/[id] — non-member', async () => {
    const m = makeMocks('GET', { id: c(2) })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('PATCH /api/relations/[id] — non-member', async () => {
    const m = makeMocks('PATCH', { id: c(2) }, { relationType: 'blocks' })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })
})

describe('404 — relation not found', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.workPackageRelationFindUnique.mockResolvedValue(null)
  })

  it('GET /api/relations/[id] — relation missing', async () => {
    const m = makeMocks('GET', { id: c(2) })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(404)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'RELATION_NOT_FOUND' },
    })
  })
})

describe('200 — happy path with project member', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.workPackageRelationFindUnique.mockImplementation(({ where }) => {
      if (where?.id && mocks.workPackageRelationFindUnique.mock.calls.length <= 1) {
        return Promise.resolve({ from: { projectId: c(1) } })
      }
      return Promise.resolve({
        id: where.id,
        relationType: 'blocks',
        fromId: c(2),
        toId: c(3),
        from: { id: c(2), subject: 'A', statusId: 's1', typeId: 't1' },
        to: { id: c(3), subject: 'B', statusId: 's1', typeId: 't1' },
      })
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
  })

  it('GET returns the relation', async () => {
    const m = makeMocks('GET', { id: c(2) })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({
      success: true,
      data: { id: c(2), relationType: 'blocks' },
    })
  })

  it('PATCH updates relationType', async () => {
    mocks.workPackageRelationUpdate.mockResolvedValue({
      id: c(2),
      relationType: 'relates',
      fromId: c(2),
      toId: c(3),
      from: { id: c(2), subject: 'A', statusId: 's1', typeId: 't1' },
      to: { id: c(3), subject: 'B', statusId: 's1', typeId: 't1' },
    })
    const m = makeMocks('PATCH', { id: c(2) }, { relationType: 'relates' })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({
      success: true,
      data: { relationType: 'relates' },
    })
  })

  it('DELETE removes the relation', async () => {
    mocks.workPackageRelationDelete.mockResolvedValue({ id: c(2) })
    const m = makeMocks('DELETE', { id: c(2) })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(204)
    expect(mocks.workPackageRelationDelete).toHaveBeenCalledWith({
      where: { id: c(2) },
    })
  })
})

describe('200 — system admin bypasses project membership check', () => {
  it('GET /api/relations/[id] with isSystemAdmin=true', async () => {
    mockSession = { user: { id: 'admin1', isSystemAdmin: true } }
    mocks.workPackageRelationFindUnique.mockImplementation(({ where }) => {
      if (where?.id) {
        return Promise.resolve({
          id: where.id,
          relationType: 'blocks',
          fromId: c(2),
          toId: c(3),
          from: { id: c(2), subject: 'A', statusId: 's1', typeId: 't1' },
          to: { id: c(3), subject: 'B', statusId: 's1', typeId: 't1' },
        })
      }
      return Promise.resolve(null)
    })
    const m = makeMocks('GET', { id: c(2) })
    await relationsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})

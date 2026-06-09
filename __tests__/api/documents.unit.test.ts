/**
 * Phase 7 Sprint B-3.2 (helpers commit) — Direct unit tests for the
 * `assertDocumentProjectMembership` and `assertFolderProjectMembership`
 * helpers in `lib/auth/project.ts`.
 *
 * Route integration tests (401/403/404 via the actual handler) are
 * shipped in the next commit (route migration) following the B-1 / B-2
 * pattern where the helper commit lands first and is independently
 * testable without handler wiring.
 *
 * Mocking strategy: `vi.hoisted` creates a stable object of vi.fn()
 * mocks that the factory closes over. This is required because
 * vi.mock factory bodies are hoisted to the top of the file — if
 * they call vi.fn() inline, the test-time mockResolvedValue calls
 * are lost (each handler import re-invokes the factory).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Stable mock handles (vi.hoisted runs before vi.mock) ──────────────────
const mocks = vi.hoisted(() => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  return {
    c,
    projectFindUnique: vi.fn(),
    memberFindUnique: vi.fn(),
    documentFindUnique: vi.fn(),
    documentFindMany: vi.fn(),
    documentCreate: vi.fn(),
    documentUpdate: vi.fn(),
    documentDelete: vi.fn(),
    documentFolderFindUnique: vi.fn(),
    documentFolderFindMany: vi.fn(),
    documentFolderCreate: vi.fn(),
    documentFolderUpdate: vi.fn(),
    documentFolderDelete: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    member: { findUnique: mocks.memberFindUnique },
    document: {
      findUnique: mocks.documentFindUnique,
      findMany: mocks.documentFindMany,
      create: mocks.documentCreate,
      update: mocks.documentUpdate,
      delete: mocks.documentDelete,
    },
    documentFolder: {
      findUnique: mocks.documentFolderFindUnique,
      findMany: mocks.documentFolderFindMany,
      create: mocks.documentFolderCreate,
      update: mocks.documentFolderUpdate,
      delete: mocks.documentFolderDelete,
    },
  },
}))

import {
  assertDocumentProjectMembership,
  assertFolderProjectMembership,
} from '@/lib/auth/project'
import { ApiError } from '@/lib/api/withRoute'

const { c } = mocks

beforeEach(() => {
  vi.clearAllMocks()
})

// ════════════════════════════════════════════════════════════════════════
//  assertDocumentProjectMembership
// ════════════════════════════════════════════════════════════════════════
describe('assertDocumentProjectMembership helper', () => {
  it('throws 400 ApiError on missing documentId', async () => {
    await expect(
      assertDocumentProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('throws 404 DOCUMENT_NOT_FOUND when document does not exist', async () => {
    mocks.documentFindUnique.mockResolvedValue(null)
    await expect(
      assertDocumentProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'DOCUMENT_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertDocumentProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path (member exists)', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertDocumentProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
    expect(mocks.documentFindUnique).toHaveBeenCalledWith({
      where: { id: c(2) },
      select: { projectId: true },
    })
  })

  it('system admin bypasses both project and member lookups', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(1) })
    const result = await assertDocumentProjectMembership(c(2), 'admin1', true)
    expect(result).toBe(c(1))
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })

  it('throws 404 PROJECT_NOT_FOUND when document belongs to non-existent project', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue(null)
    await expect(
      assertDocumentProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'PROJECT_NOT_FOUND' })
  })
})

// ════════════════════════════════════════════════════════════════════════
//  assertFolderProjectMembership
// ════════════════════════════════════════════════════════════════════════
describe('assertFolderProjectMembership helper', () => {
  it('throws 400 ApiError on missing folderId', async () => {
    await expect(
      assertFolderProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('throws 404 FOLDER_NOT_FOUND when folder does not exist', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue(null)
    await expect(
      assertFolderProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'FOLDER_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertFolderProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path (member exists)', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertFolderProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
    expect(mocks.documentFolderFindUnique).toHaveBeenCalledWith({
      where: { id: c(2) },
      select: { projectId: true },
    })
  })

  it('system admin bypasses both project and member lookups', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue({ projectId: c(1) })
    const result = await assertFolderProjectMembership(c(2), 'admin1', true)
    expect(result).toBe(c(1))
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})




// ─── Route integration tests (added in B-3.2b route-migration commit) ──
import type { NextApiRequest, NextApiResponse } from 'next'


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


// Import routes AFTER all mocks
import documentsRoute from '@/pages/api/documents'
import documentIdRoute from '@/pages/api/documents/[id]'
import foldersRoute from '@/pages/api/documents/folders'
import folderIdRoute from '@/pages/api/documents/folders/[id]'

function makeRouteMocks(
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

describe('401 — unauthenticated requests blocked by withRoute HOF', () => {
  beforeEach(() => {
    mockSession = null
  })

  it('GET /api/documents', async () => {
    const m = makeRouteMocks('GET', undefined, { projectId: c(1) })
    await documentsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('POST /api/documents', async () => {
    const m = makeRouteMocks('POST', { projectId: c(1), title: 'x', authorId: 'u1' })
    await documentsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('GET /api/documents/[id]', async () => {
    const m = makeRouteMocks('GET', undefined, { id: c(2) })
    await documentIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('GET /api/documents/folders', async () => {
    const m = makeRouteMocks('GET', undefined, { projectId: c(1) })
    await foldersRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })

  it('GET /api/documents/folders/[id]', async () => {
    const m = makeRouteMocks('GET', undefined, { id: c(2) })
    await folderIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(401)
  })
})

describe('403 — authenticated non-member is denied', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
  })

  it('GET /api/documents?projectId=...', async () => {
    const m = makeRouteMocks('GET', undefined, { projectId: c(1) })
    await documentsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('POST /api/documents (body projectId) — non-member', async () => {
    const m = makeRouteMocks('POST', {
      projectId: c(1), title: 'x', authorId: 'u1',
    })
    await documentsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('GET /api/documents/[id] — non-member of owning project', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(1) })
    const m = makeRouteMocks('GET', undefined, { id: c(2) })
    await documentIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })

  it('GET /api/documents/folders/[id] — non-member', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue({ projectId: c(1) })
    const m = makeRouteMocks('GET', undefined, { id: c(2) })
    await folderIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(403)
  })
})

describe('404 — document / folder not found', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
  })

  it('GET /api/documents/[id] — document not found', async () => {
    mocks.documentFindUnique.mockResolvedValue(null)
    const m = makeRouteMocks('GET', undefined, { id: c(2) })
    await documentIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(404)
    expect(m.getJson()).toMatchObject({
      success: false,
      error: { code: 'DOCUMENT_NOT_FOUND' },
    })
  })

  it('GET /api/documents/folders/[id] — folder not found', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue(null)
    const m = makeRouteMocks('GET', undefined, { id: c(2) })
    await folderIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(404)
  })
})

describe('400 — bad request', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
  })

  it('GET /api/documents without projectId', async () => {
    const m = makeRouteMocks('GET')
    await documentsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(400)
  })

  it('GET /api/documents/folders without projectId', async () => {
    const m = makeRouteMocks('GET')
    await foldersRoute(m.req, m.res)
    expect(m.getStatus()).toBe(400)
  })
})

describe('200 — happy path with project member', () => {
  beforeEach(() => {
    mockSession = { user: { id: 'u1' } }
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
  })

  it('GET /api/documents?projectId=...', async () => {
    mocks.documentFindMany.mockResolvedValue([{ id: c(2) }])
    const m = makeRouteMocks('GET', undefined, { projectId: c(1) })
    await documentsRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({ success: true, data: [{ id: c(2) }] })
  })

  it('GET /api/documents/[id]', async () => {
    const document = { id: c(2), projectId: c(1), title: 'X' }
    mocks.documentFindUnique
      .mockResolvedValueOnce({ projectId: c(1) })
      .mockResolvedValueOnce(document)
    const m = makeRouteMocks('GET', undefined, { id: c(2) })
    await documentIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(m.getJson()).toMatchObject({ success: true, data: document })
  })
})

describe('200 — system admin bypasses project membership check', () => {
  it('GET /api/documents/[id] with isSystemAdmin=true', async () => {
    mockSession = { user: { id: 'admin1', isSystemAdmin: true } }
    const document = { id: c(2), projectId: c(1), title: 'X' }
    mocks.documentFindUnique
      .mockResolvedValueOnce({ projectId: c(1) })
      .mockResolvedValueOnce(document)
    const m = makeRouteMocks('GET', undefined, { id: c(2) })
    await documentIdRoute(m.req, m.res)
    expect(m.getStatus()).toBe(200)
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// ============================================================
// Unit tests for Phase 4 Wiki API routes
// Mock Prisma + @upstash/redis (Redis connects at module load time)
// ============================================================

// vi.hoisted is hoisted alongside vi.mock — use for shared values
const { cuid } = vi.hoisted(() => {
  const cuid = (n: number) => `c${'0'.repeat(24)}${n}`
  return { cuid }
})

// --- Mock Redis ---
vi.mock('@upstash/redis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  }
  return { Redis: { fromEnv: () => mockRedis } }
})

vi.mock('@upstash/ratelimit', () => {
  const MockRatelimitClass = function(_opts: { redis: unknown; limiter: unknown }) {
    return { limit: vi.fn(() => Promise.resolve({ success: true })) }
  } as any
  MockRatelimitClass.slidingWindow = vi.fn((_a: number, _b: string) => MockRatelimitClass)
  return { Ratelimit: MockRatelimitClass }
})

// --- Mock Prisma ---
vi.mock('@/lib/prisma', () => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  const mockAuthor = { id: c(1), name: 'Wiki Author', email: 'author@example.com', avatarUrl: null }
  const mockProject = { id: c(2), name: 'Test Project', identifier: 'test-project' }
  const mockWikiPage = {
    id: c(3),
    projectId: c(2),
    title: 'Test Wiki Page',
    slug: 'test-wiki-page',
    content: '# Hello\n\nWorld',
    parentId: null,
    authorId: c(1),
    version: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
  const mockVersion = {
    id: c(10),
    wikiPageId: c(3),
    content: '# Hello\n\nWorld',
    authorId: c(1),
    version: 1,
    createdAt: new Date('2026-01-01'),
  }

  return {
    prisma: {
      wikiPage: {
        findUnique: vi.fn().mockResolvedValue(mockWikiPage),
        findMany: vi.fn().mockResolvedValue([mockWikiPage]),
        create: vi.fn().mockResolvedValue({ ...mockWikiPage, id: c(99) }),
        update: vi.fn().mockResolvedValue({ ...mockWikiPage, version: 2 }),
        delete: vi.fn().mockResolvedValue(mockWikiPage),
      },
      wikiPageVersion: {
        findMany: vi.fn().mockResolvedValue([mockVersion]),
        findFirst: vi.fn().mockResolvedValue(mockVersion),
        create: vi.fn().mockResolvedValue({ ...mockVersion, id: c(11), version: 2 }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(mockAuthor),
      },
      project: {
        findUnique: vi.fn().mockResolvedValue(mockProject),
      },
      $transaction: vi.fn().mockImplementation(async (cb: unknown) => {
        const mockTx = {
          wikiPage: {
            create: vi.fn().mockResolvedValue({ ...mockWikiPage, id: c(99) }),
            update: vi.fn().mockResolvedValue({ ...mockWikiPage, version: 2 }),
          },
          wikiPageVersion: {
            create: vi.fn().mockResolvedValue({ ...mockVersion, id: c(11), version: 2 }),
          },
        }
        return cb(mockTx)
      }),
    },
  }
})

// ─── Import routes AFTER mocks ──────────────────────────────────────────────
import wikiHandler from '@/pages/api/wiki/index'
import wikiIdHandler from '@/pages/api/wiki/[id]'
import versionsHandler from '@/pages/api/wiki/[id]/versions'
import restoreHandler from '@/pages/api/wiki/[id]/restore'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMocks(method: string, body?: Record<string, unknown>, query?: Record<string, string>) {
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
    getStatusCode: () => statusCode,
    status: (code: number) => { statusCode = code; return mockRes },
    json: (data: unknown) => { jsonData = data; return mockRes },
    setHeader: () => mockRes,
    end: vi.fn(),
    _getData: () => typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData),
  } as unknown as NextApiResponse & { _getData: () => string; end: ReturnType<typeof vi.fn> }

  return { req: mockReq, res: mockRes }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const c = (n: number) => `c${'0'.repeat(24)}${n}`

// ============================================================
// GET /api/wiki
// ============================================================
describe('GET /api/wiki', () => {
  it.skip('returns 200 with wiki pages array', async () => {
    const { req, res } = makeMocks('GET')
    await wikiHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
    expect(data[0]).toHaveProperty('id')
    expect(data[0]).toHaveProperty('title')
    expect(data[0]).toHaveProperty('slug')
  })

  it.skip('filters by projectId when provided', async () => {
    const { req, res } = makeMocks('GET', {}, { projectId: c(2) })
    await wikiHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const { prisma } = await import('@/lib/prisma')
    expect(prisma.wikiPage.findMany).toHaveBeenCalled()
  })

  it.skip('returns 405 for POST', async () => {
    const { req, res } = makeMocks('POST', { title: 'Test' })
    await wikiHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// POST /api/wiki
// ============================================================
describe('POST /api/wiki', () => {
  it.skip('returns 201 on valid create', async () => {
    const { req, res } = makeMocks('POST', {
      projectId: c(2),
      title: 'New Wiki Page',
      content: '# Content',
      authorId: c(1),
    })
    await wikiHandler(req, res)
    expect(res.getStatusCode()).toBe(201)
  })

  it.skip('returns 400 when title is missing', async () => {
    const { req, res } = makeMocks('POST', {
      projectId: c(2),
      authorId: c(1),
    })
    await wikiHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
    const data = JSON.parse((res as any)._getData())
    expect(data.error).toBe('Validation failed')
  })

  it.skip('returns 400 when projectId is missing', async () => {
    const { req, res } = makeMocks('POST', {
      title: 'Test Page',
      authorId: c(1),
    })
    await wikiHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it.skip('returns 400 when authorId is missing', async () => {
    const { req, res } = makeMocks('POST', {
      projectId: c(2),
      title: 'Test Page',
    })
    await wikiHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it.skip('returns 400 when cuid format is invalid', async () => {
    const { req, res } = makeMocks('POST', {
      projectId: 'not-a-cuid',
      title: 'Test Page',
      authorId: 'also-invalid',
    })
    await wikiHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
    const data = JSON.parse((res as any)._getData())
    expect(data.error).toBe('Validation failed')
  })
})

// ============================================================
// GET /api/wiki/[id]
// ============================================================
describe('GET /api/wiki/[id]', () => {
  it.skip('returns 200 with wiki page', async () => {
    const { req, res } = makeMocks('GET', {}, { id: c(3) })
    await wikiIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('title')
  })

  it.skip('returns 404 when page not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('GET', {}, { id: 'nonexistent' })
    await wikiIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })

  it.skip('returns 405 for PATCH', async () => {
    const { req, res } = makeMocks('PATCH', { title: 'Updated' }, { id: c(3) })
    await wikiIdHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// PATCH /api/wiki/[id]
// ============================================================
describe('PATCH /api/wiki/[id]', () => {
  it.skip('returns 200 on valid update', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), title: 'Test', slug: 'test', content: 'old', parentId: null, authorId: c(1), version: 1, createdAt: new Date(), updatedAt: new Date()
    })

    const { req, res } = makeMocks('PATCH', { title: 'Updated Title', content: 'New content' }, { id: c(3) })
    await wikiIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 400 when cuid format is invalid', async () => {
    const { req, res } = makeMocks('PATCH', { title: 'Updated' }, { id: 'not-cuid' })
    await wikiIdHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it.skip('returns 404 when page not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('PATCH', { title: 'Updated' }, { id: 'nonexistent' })
    await wikiIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// DELETE /api/wiki/[id]
// ============================================================
describe('DELETE /api/wiki/[id]', () => {
  it.skip('returns 204 on successful delete', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), title: 'Test', slug: 'test', content: '', parentId: null, authorId: c(1), version: 1, createdAt: new Date(), updatedAt: new Date(), _count: { children: 0 }
    })

    const { req, res } = makeMocks('DELETE', {}, { id: c(3) })
    await wikiIdHandler(req, res)
    expect(res.getStatusCode()).toBe(204)
  })

  it.skip('returns 400 when page has child pages', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), title: 'Test', slug: 'test', content: '', parentId: null, authorId: c(1), version: 1, createdAt: new Date(), updatedAt: new Date(), _count: { children: 2 }
    })

    const { req, res } = makeMocks('DELETE', {}, { id: c(3) })
    await wikiIdHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
    const data = JSON.parse((res as any)._getData())
    expect(data.error).toContain('child pages')
  })

  it.skip('returns 404 when page not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('DELETE', {}, { id: 'nonexistent' })
    await wikiIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// GET /api/wiki/[id]/versions
// ============================================================
describe('GET /api/wiki/[id]/versions', () => {
  it.skip('returns 200 with versions array', async () => {
    const { req, res } = makeMocks('GET', {}, { id: c(3) })
    await versionsHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
    expect(data[0]).toHaveProperty('version')
    expect(data[0]).toHaveProperty('content')
  })

  it.skip('returns 404 when page not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('GET', {}, { id: 'nonexistent' })
    await versionsHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })

  it.skip('returns 405 for POST', async () => {
    const { req, res } = makeMocks('POST', {}, { id: c(3) })
    await versionsHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// POST /api/wiki/[id]/restore
// ============================================================
describe('POST /api/wiki/[id]/restore', () => {
  it.skip('returns 200 on successful restore', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), title: 'Test', slug: 'test', content: 'current', parentId: null, authorId: c(1), version: 2, createdAt: new Date(), updatedAt: new Date()
    })
    ;(prisma.wikiPageVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(10), wikiPageId: c(3), content: 'old content', authorId: c(1), version: 1, createdAt: new Date()
    })

    const { req, res } = makeMocks('POST', { version: 1 }, { id: c(3) })
    await restoreHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 400 when version is missing', async () => {
    const { req, res } = makeMocks('POST', {}, { id: c(3) })
    await restoreHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
    const data = JSON.parse((res as any)._getData())
    expect(data.error).toBe('Validation failed')
  })

  it.skip('returns 400 when version is not a positive integer', async () => {
    const { req, res } = makeMocks('POST', { version: -1 }, { id: c(3) })
    await restoreHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it.skip('returns 404 when page not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('POST', { version: 1 }, { id: 'nonexistent' })
    await restoreHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })

  it.skip('returns 404 when target version not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.wikiPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), title: 'Test', slug: 'test', content: 'current', parentId: null, authorId: c(1), version: 2, createdAt: new Date(), updatedAt: new Date()
    })
    ;(prisma.wikiPageVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('POST', { version: 99 }, { id: c(3) })
    await restoreHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })

  it.skip('returns 405 for GET', async () => {
    const { req, res } = makeMocks('GET', {}, { id: c(3) })
    await restoreHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

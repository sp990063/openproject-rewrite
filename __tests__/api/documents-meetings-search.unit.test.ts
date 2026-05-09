import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// ============================================================
// Unit tests for Phase 4 Documents + Meetings + Search API routes
// Mock Prisma + @upstash/redis (Redis connects at module load time)
// ============================================================

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
  const mockAuthor = { id: c(1), name: 'Test Author', email: 'author@example.com', avatarUrl: null }
  const mockProject = { id: c(2), name: 'Test Project', identifier: 'test-project' }
  const mockFolder = { id: c(3), projectId: c(2), name: 'Test Folder', parentId: null, createdAt: new Date('2026-01-01') }
  const mockDocument = {
    id: c(4),
    projectId: c(2),
    title: 'Test Document',
    description: 'A test document',
    folderId: c(3),
    authorId: c(1),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
  const mockMeeting = {
    id: c(5),
    projectId: c(2),
    title: 'Test Meeting',
    startTime: new Date('2026-02-01T10:00:00Z'),
    endTime: new Date('2026-02-01T11:00:00Z'),
    location: 'Room 101',
    authorId: c(1),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
  const mockAttendee = {
    id: c(6),
    meetingId: c(5),
    userId: c(1),
    response: 'none',
    comment: null,
  }
  const mockAgendaItem = {
    id: c(7),
    meetingId: c(5),
    title: 'Agenda Item 1',
    notes: 'Some notes',
    duration: 30,
    position: 0,
  }
  const mockMinutes = {
    id: c(8),
    meetingId: c(5),
    content: 'Meeting minutes content',
    authorId: c(1),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }

  return {
    prisma: {
      document: {
        findUnique: vi.fn().mockResolvedValue(mockDocument),
        findMany: vi.fn().mockResolvedValue([mockDocument]),
        create: vi.fn().mockResolvedValue({ ...mockDocument, id: c(99) }),
        update: vi.fn().mockResolvedValue({ ...mockDocument, title: 'Updated Document' }),
        delete: vi.fn().mockResolvedValue(mockDocument),
      },
      documentFolder: {
        findUnique: vi.fn().mockResolvedValue(mockFolder),
        findMany: vi.fn().mockResolvedValue([mockFolder]),
        create: vi.fn().mockResolvedValue({ ...mockFolder, id: c(98) }),
        update: vi.fn().mockResolvedValue({ ...mockFolder, name: 'Updated Folder' }),
        delete: vi.fn().mockResolvedValue(mockFolder),
        count: vi.fn().mockResolvedValue(0),
      },
      meeting: {
        findUnique: vi.fn().mockResolvedValue(mockMeeting),
        findMany: vi.fn().mockResolvedValue([mockMeeting]),
        create: vi.fn().mockResolvedValue({ ...mockMeeting, id: c(95) }),
        update: vi.fn().mockResolvedValue({ ...mockMeeting, title: 'Updated Meeting' }),
        delete: vi.fn().mockResolvedValue(mockMeeting),
      },
      meetingAttendee: {
        findMany: vi.fn().mockResolvedValue([{ ...mockAttendee, user: mockAuthor }]),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      meetingAgendaItem: {
        findMany: vi.fn().mockResolvedValue([mockAgendaItem]),
        create: vi.fn().mockResolvedValue({ ...mockAgendaItem, id: c(94) }),
        update: vi.fn().mockResolvedValue({ ...mockAgendaItem, title: 'Updated Agenda' }),
        delete: vi.fn().mockResolvedValue(mockAgendaItem),
      },
      meetingMinutes: {
        findUnique: vi.fn().mockResolvedValue(mockMinutes),
        create: vi.fn().mockResolvedValue({ ...mockMinutes, id: c(93) }),
        update: vi.fn().mockResolvedValue({ ...mockMinutes, content: 'Updated content' }),
      },
      wikiPage: {
        findMany: vi.fn().mockResolvedValue([{ id: c(10), title: 'Wiki Page', slug: 'wiki-page', content: 'content', projectId: c(2), project: mockProject, updatedAt: new Date() }]),
      },
      forumThread: {
        findMany: vi.fn().mockResolvedValue([{ id: c(11), subject: 'Forum Thread', forumId: c(3), forum: { name: 'Forum', project: mockProject }, updatedAt: new Date() }]),
      },
      workPackage: {
        findMany: vi.fn().mockResolvedValue([{ id: c(12), subject: 'Work Package', projectId: c(2), project: mockProject, type: { id: c(20), name: 'Task', color: '#fff' }, status: { id: c(21), name: 'Open', color: '#0f0' }, description: 'desc', updatedAt: new Date() }]),
      },
      user: { findUnique: vi.fn().mockResolvedValue(mockAuthor) },
      project: { findUnique: vi.fn().mockResolvedValue(mockProject) },
    },
  }
})

// ─── Import routes AFTER mocks ──────────────────────────────────────────────
import documentsHandler from '@/pages/api/documents/index'
import documentIdHandler from '@/pages/api/documents/[id]/index'
import foldersHandler from '@/pages/api/documents/folders/index'
import folderIdHandler from '@/pages/api/documents/folders/[id]/index'
import meetingsHandler from '@/pages/api/meetings/index'
import meetingIdHandler from '@/pages/api/meetings/[id]/index'
import attendeesHandler from '@/pages/api/meetings/[id]/attendees/index'
import agendaHandler from '@/pages/api/meetings/[id]/agenda/index'
import agendaItemHandler from '@/pages/api/meetings/[id]/agenda/[agendaId]/index'
import minutesHandler from '@/pages/api/meetings/[id]/minutes/index'
import searchHandler from '@/pages/api/search/index'

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
// GET /api/documents
// ============================================================
describe('GET /api/documents', () => {
  it.skip('returns 200 with documents array', async () => {
    const { req, res } = makeMocks('GET')
    await documentsHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
    expect(data[0]).toHaveProperty('id')
    expect(data[0]).toHaveProperty('title')
  })

  it.skip('filters by projectId when provided', async () => {
    const { req, res } = makeMocks('GET', {}, { projectId: c(2) })
    await documentsHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 405 for POST', async () => {
    const { req, res } = makeMocks('POST', { title: 'Test' })
    await documentsHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// POST /api/documents
// ============================================================
describe('POST /api/documents', () => {
  it.skip('returns 201 on valid create', async () => {
    const { req, res } = makeMocks('POST', {
      projectId: c(2),
      title: 'New Document',
      description: 'A new doc',
      authorId: c(1),
    })
    await documentsHandler(req, res)
    expect(res.getStatusCode()).toBe(201)
  })

  it.skip('returns 400 when title is missing', async () => {
    const { req, res } = makeMocks('POST', { projectId: c(2), authorId: c(1) })
    await documentsHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it.skip('returns 400 when cuid format is invalid', async () => {
    const { req, res } = makeMocks('POST', { projectId: 'not-cuid', title: 'Test', authorId: 'also-invalid' })
    await documentsHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// GET /api/documents/[id]
// ============================================================
describe('GET /api/documents/[id]', () => {
  it.skip('returns 200 with document', async () => {
    const { req, res } = makeMocks('GET', {}, { id: c(4) })
    await documentIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('title')
  })

  it.skip('returns 404 when document not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('GET', {}, { id: 'nonexistent' })
    await documentIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// PATCH /api/documents/[id]
// ============================================================
describe('PATCH /api/documents/[id]', () => {
  it.skip('returns 200 on valid update', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(4), projectId: c(2), title: 'Test', description: null, folderId: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date()
    })
    const { req, res } = makeMocks('PATCH', { title: 'Updated Title' }, { id: c(4) })
    await documentIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 404 when document not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('PATCH', { title: 'Updated' }, { id: 'nonexistent' })
    await documentIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// DELETE /api/documents/[id]
// ============================================================
describe('DELETE /api/documents/[id]', () => {
  it.skip('returns 204 on successful delete', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(4), projectId: c(2), title: 'Test', description: null, folderId: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date()
    })
    const { req, res } = makeMocks('DELETE', {}, { id: c(4) })
    await documentIdHandler(req, res)
    expect(res.getStatusCode()).toBe(204)
  })

  it.skip('returns 404 when document not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('DELETE', {}, { id: 'nonexistent' })
    await documentIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// GET /api/documents/folders
// ============================================================
describe('GET /api/documents/folders', () => {
  it.skip('returns 200 with folders array', async () => {
    const { req, res } = makeMocks('GET')
    await foldersHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
    expect(data[0]).toHaveProperty('name')
  })

  it.skip('returns 405 for POST', async () => {
    const { req, res } = makeMocks('POST', { name: 'Test' })
    await foldersHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// POST /api/documents/folders
// ============================================================
describe('POST /api/documents/folders', () => {
  it.skip('returns 201 on valid create', async () => {
    const { req, res } = makeMocks('POST', { projectId: c(2), name: 'New Folder' })
    await foldersHandler(req, res)
    expect(res.getStatusCode()).toBe(201)
  })

  it.skip('returns 400 when name is missing', async () => {
    const { req, res } = makeMocks('POST', { projectId: c(2) })
    await foldersHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// GET /api/documents/folders/[id]
// ============================================================
describe('GET /api/documents/folders/[id]', () => {
  it.skip('returns 200 with folder', async () => {
    const { req, res } = makeMocks('GET', {}, { id: c(3) })
    await folderIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 404 when folder not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.documentFolder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('GET', {}, { id: 'nonexistent' })
    await folderIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// PATCH /api/documents/folders/[id]
// ============================================================
describe('PATCH /api/documents/folders/[id]', () => {
  it.skip('returns 200 on valid update', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.documentFolder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), name: 'Test', parentId: null, createdAt: new Date(), _count: { documents: 0, children: 0 }
    })
    const { req, res } = makeMocks('PATCH', { name: 'Updated Folder' }, { id: c(3) })
    await folderIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 400 when setting itself as parent', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.documentFolder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), name: 'Test', parentId: null, createdAt: new Date(), _count: { documents: 0, children: 0 }
    })
    const { req, res } = makeMocks('PATCH', { parentId: c(3) }, { id: c(3) })
    await folderIdHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// DELETE /api/documents/folders/[id]
// ============================================================
describe('DELETE /api/documents/folders/[id]', () => {
  it.skip('returns 204 on successful delete', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.documentFolder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), name: 'Test', parentId: null, createdAt: new Date(), _count: { documents: 0, children: 0 }
    })
    const { req, res } = makeMocks('DELETE', {}, { id: c(3) })
    await folderIdHandler(req, res)
    expect(res.getStatusCode()).toBe(204)
  })

  it.skip('returns 400 when folder has documents', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.documentFolder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), name: 'Test', parentId: null, createdAt: new Date(), _count: { documents: 5, children: 0 }
    })
    const { req, res } = makeMocks('DELETE', {}, { id: c(3) })
    await folderIdHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it.skip('returns 400 when folder has subfolders', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.documentFolder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(3), projectId: c(2), name: 'Test', parentId: null, createdAt: new Date(), _count: { documents: 0, children: 3 }
    })
    const { req, res } = makeMocks('DELETE', {}, { id: c(3) })
    await folderIdHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// GET /api/meetings
// ============================================================
describe('GET /api/meetings', () => {
  it.skip('returns 200 with meetings array', async () => {
    const { req, res } = makeMocks('GET')
    await meetingsHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
    expect(data[0]).toHaveProperty('title')
  })

  it.skip('returns 405 for POST', async () => {
    const { req, res } = makeMocks('POST', { title: 'Test' })
    await meetingsHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// POST /api/meetings
// ============================================================
describe('POST /api/meetings', () => {
  it.skip('returns 201 on valid create', async () => {
    const { req, res } = makeMocks('POST', {
      projectId: c(2),
      title: 'New Meeting',
      startTime: '2026-03-01T10:00:00Z',
      endTime: '2026-03-01T11:00:00Z',
      authorId: c(1),
    })
    await meetingsHandler(req, res)
    expect(res.getStatusCode()).toBe(201)
  })

  it.skip('returns 400 when end time is before start time', async () => {
    const { req, res } = makeMocks('POST', {
      projectId: c(2),
      title: 'Bad Meeting',
      startTime: '2026-03-01T11:00:00Z',
      endTime: '2026-03-01T10:00:00Z',
      authorId: c(1),
    })
    await meetingsHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it.skip('returns 400 when cuid format is invalid', async () => {
    const { req, res } = makeMocks('POST', {
      projectId: 'not-cuid',
      title: 'Test',
      startTime: '2026-03-01T10:00:00Z',
      endTime: '2026-03-01T11:00:00Z',
      authorId: 'also-invalid',
    })
    await meetingsHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// GET /api/meetings/[id]
// ============================================================
describe('GET /api/meetings/[id]', () => {
  it.skip('returns 200 with meeting', async () => {
    const { req, res } = makeMocks('GET', {}, { id: c(5) })
    await meetingIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(data).toHaveProperty('title')
  })

  it.skip('returns 404 when meeting not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('GET', {}, { id: 'nonexistent' })
    await meetingIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// PATCH /api/meetings/[id]
// ============================================================
describe('PATCH /api/meetings/[id]', () => {
  it.skip('returns 200 on valid update', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(5), projectId: c(2), title: 'Test', startTime: new Date('2026-02-01T10:00:00Z'), endTime: new Date('2026-02-01T11:00:00Z'), location: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date(), attendees: []
    })
    const { req, res } = makeMocks('PATCH', { title: 'Updated Meeting' }, { id: c(5) })
    await meetingIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 404 when meeting not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('PATCH', { title: 'Updated' }, { id: 'nonexistent' })
    await meetingIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// DELETE /api/meetings/[id]
// ============================================================
describe('DELETE /api/meetings/[id]', () => {
  it.skip('returns 204 on successful delete', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(5), projectId: c(2), title: 'Test', startTime: new Date(), endTime: new Date(), location: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date()
    })
    const { req, res } = makeMocks('DELETE', {}, { id: c(5) })
    await meetingIdHandler(req, res)
    expect(res.getStatusCode()).toBe(204)
  })
})

// ============================================================
// POST /api/meetings/[id]/attendees
// ============================================================
describe('POST /api/meetings/[id]/attendees', () => {
  it.skip('returns 200 on successful attendee update', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(5), projectId: c(2), title: 'Test', startTime: new Date('2026-02-01T10:00:00Z'), endTime: new Date('2026-02-01T11:00:00Z'), location: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date(), attendees: []
    })
    const { req, res } = makeMocks('POST', { attendees: [{ userId: c(1), response: 'accepted' }] }, { id: c(5) })
    await attendeesHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 404 when meeting not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('POST', { attendees: [] }, { id: 'nonexistent' })
    await attendeesHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })

  it.skip('returns 405 for GET', async () => {
    const { req, res } = makeMocks('GET', {}, { id: c(5) })
    await attendeesHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// GET /api/meetings/[id]/agenda
// ============================================================
describe('GET /api/meetings/[id]/agenda', () => {
  it.skip('returns 200 with agenda items', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(5), projectId: c(2), title: 'Test', startTime: new Date(), endTime: new Date(), location: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date()
    })
    const { req, res } = makeMocks('GET', {}, { id: c(5) })
    await agendaHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 404 when meeting not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('GET', {}, { id: 'nonexistent' })
    await agendaHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// POST /api/meetings/[id]/agenda
// ============================================================
describe('POST /api/meetings/[id]/agenda', () => {
  it.skip('returns 201 on valid create', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(5), projectId: c(2), title: 'Test', startTime: new Date(), endTime: new Date(), location: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date()
    })
    const { req, res } = makeMocks('POST', { title: 'New Agenda Item', duration: 30 }, { id: c(5) })
    await agendaHandler(req, res)
    expect(res.getStatusCode()).toBe(201)
  })

  it.skip('returns 400 when title is missing', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(5), projectId: c(2), title: 'Test', startTime: new Date(), endTime: new Date(), location: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date()
    })
    const { req, res } = makeMocks('POST', { duration: 30 }, { id: c(5) })
    await agendaHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// PATCH /api/meetings/[id]/agenda/[agendaId]
// ============================================================
describe('PATCH /api/meetings/[id]/agenda/[agendaId]', () => {
  it.skip('returns 200 on valid update', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meetingAgendaItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(7), meetingId: c(5), title: 'Test', notes: null, duration: 30, position: 0
    })
    const { req, res } = makeMocks('PATCH', { title: 'Updated Agenda' }, { id: c(5), agendaId: c(7) })
    await agendaItemHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 404 when agenda item not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meetingAgendaItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('PATCH', { title: 'Updated' }, { id: c(5), agendaId: 'nonexistent' })
    await agendaItemHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })

  it.skip('returns 400 when agenda item belongs to different meeting', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meetingAgendaItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(7), meetingId: 'different-meeting', title: 'Test', notes: null, duration: 30, position: 0
    })
    const { req, res } = makeMocks('PATCH', { title: 'Updated' }, { id: c(5), agendaId: c(7) })
    await agendaItemHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// DELETE /api/meetings/[id]/agenda/[agendaId]
// ============================================================
describe('DELETE /api/meetings/[id]/agenda/[agendaId]', () => {
  it.skip('returns 204 on successful delete', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meetingAgendaItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(7), meetingId: c(5), title: 'Test', notes: null, duration: 30, position: 0
    })
    const { req, res } = makeMocks('DELETE', {}, { id: c(5), agendaId: c(7) })
    await agendaItemHandler(req, res)
    expect(res.getStatusCode()).toBe(204)
  })
})

// ============================================================
// GET /api/meetings/[id]/minutes
// ============================================================
describe('GET /api/meetings/[id]/minutes', () => {
  it.skip('returns 200 with minutes', async () => {
    const { req, res } = makeMocks('GET', {}, { id: c(5) })
    await minutesHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 404 when minutes not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meetingMinutes.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('GET', {}, { id: c(5) })
    await minutesHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// POST /api/meetings/[id]/minutes
// ============================================================
describe('POST /api/meetings/[id]/minutes', () => {
  it.skip('returns 201 on valid create', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(5), projectId: c(2), title: 'Test', startTime: new Date(), endTime: new Date(), location: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date()
    })
    ;(prisma.meetingMinutes.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('POST', { content: 'Minutes content', authorId: c(1) }, { id: c(5) })
    await minutesHandler(req, res)
    expect(res.getStatusCode()).toBe(201)
  })

  it.skip('returns 409 when minutes already exist', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: c(5), projectId: c(2), title: 'Test', startTime: new Date(), endTime: new Date(), location: null, authorId: c(1), createdAt: new Date(), updatedAt: new Date()
    })
    const { req, res } = makeMocks('POST', { content: 'Minutes content', authorId: c(1) }, { id: c(5) })
    await minutesHandler(req, res)
    expect(res.getStatusCode()).toBe(409)
  })

  it.skip('returns 404 when meeting not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meeting.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('POST', { content: 'Minutes', authorId: c(1) }, { id: 'nonexistent' })
    await minutesHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// PATCH /api/meetings/[id]/minutes
// ============================================================
describe('PATCH /api/meetings/[id]/minutes', () => {
  it.skip('returns 200 on valid update', async () => {
    const { req, res } = makeMocks('PATCH', { content: 'Updated minutes content' }, { id: c(5) })
    await minutesHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 404 when minutes not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.meetingMinutes.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    const { req, res } = makeMocks('PATCH', { content: 'Updated' }, { id: c(5) })
    await minutesHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// POST /api/search
// ============================================================
describe('POST /api/search', () => {
  it.skip('returns 200 with search results', async () => {
    const { req, res } = makeMocks('POST', { q: 'test', limit: 20, offset: 0 })
    await searchHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(data).toHaveProperty('query')
    expect(data).toHaveProperty('results')
    expect(Array.isArray(data.results)).toBe(true)
  })

  it.skip('filters by projectId when provided', async () => {
    const { req, res } = makeMocks('POST', { q: 'test', projectId: c(2) })
    await searchHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('filters by types when provided', async () => {
    const { req, res } = makeMocks('POST', { q: 'test', types: ['wiki', 'document'] })
    await searchHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it.skip('returns 400 when query is missing', async () => {
    const { req, res } = makeMocks('POST', {})
    await searchHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it.skip('returns 400 when query is empty', async () => {
    const { req, res } = makeMocks('POST', { q: '   ' })
    await searchHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it.skip('returns 405 for GET', async () => {
    const { req, res } = makeMocks('GET', { q: 'test' })
    await searchHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

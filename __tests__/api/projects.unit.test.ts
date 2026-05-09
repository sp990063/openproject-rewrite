import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// ============================================================
// Unit tests for Phase 3 Project API routes
// Mock Prisma + @upstash/redis (Redis connects at module load time)
// ============================================================

// vi.hoisted is hoisted alongside vi.mock — use for shared values
const { cuid, mockPrismaInstance } = vi.hoisted(() => {
  const cuid = (n: number) => `c${'0'.repeat(24)}${n}`
  const mockRole = { id: cuid(1), name: 'Admin', permissions: ['*'] }
  const mockMember = { id: cuid(10), userId: cuid(20), projectId: cuid(30), roleId: cuid(1), createdAt: new Date() }
  const mockModule = { id: cuid(40), projectId: cuid(30), module: 'work_packages', enabled: true }
  const mockVersion = { id: cuid(50), projectId: cuid(30), name: 'v1.0', status: 'open', dueDate: null }
  const mockProject = {
    id: cuid(30),
    name: 'Test Project',
    description: null,
    identifier: 'test-project',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const mockPrismaInstance = {
    project: {
      findUnique: vi.fn().mockResolvedValue(mockProject),
      findMany: vi.fn().mockResolvedValue([mockProject]),
      create: vi.fn().mockResolvedValue({ ...mockProject, id: cuid(99) }),
      update: vi.fn().mockResolvedValue(mockProject),
      delete: vi.fn().mockResolvedValue(mockProject),
    },
    member: {
      findMany: vi.fn().mockResolvedValue([mockMember]),
      findUnique: vi.fn().mockResolvedValue(mockMember),
      create: vi.fn().mockResolvedValue(mockMember),
      update: vi.fn().mockResolvedValue(mockMember),
      delete: vi.fn().mockResolvedValue(mockMember),
    },
    role: {
      findMany: vi.fn().mockResolvedValue([mockRole]),
      findUnique: vi.fn().mockResolvedValue(mockRole),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: cuid(20), name: 'Test User', email: 'test@example.com' }),
    },
    projectModule: {
      findMany: vi.fn().mockResolvedValue([mockModule]),
      upsert: vi.fn().mockImplementation(async ({ create }: { create: object }) => create),
    },
    version: {
      findMany: vi.fn().mockResolvedValue([mockVersion]),
    },
  }
  // $transaction must reference mockPrismaInstance by name from the enclosing scope
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(mockPrismaInstance as any).$transaction = vi.fn().mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (cb: any) => {
      // If cb is an array (sequential mode), call with each item; otherwise call as transactional client
      if (Array.isArray(cb)) return cb.map((item) => cb(item))
      return cb(mockPrismaInstance)
    }
  )
  return { cuid, mockPrismaInstance }
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
  const MockRatelimitClass = function (_opts: { redis: unknown; limiter: unknown }) {
    return { limit: vi.fn(() => Promise.resolve({ success: true })) }
  } as any
  MockRatelimitClass.slidingWindow = vi.fn((_a: number, _b: string) => MockRatelimitClass)
  return { Ratelimit: MockRatelimitClass }
})

// --- Mock Prisma ---
vi.mock('@/lib/prisma', () => {
  // Use the cuid from outer scope
  const mockRole = { id: cuid(1), name: 'Admin', permissions: ['*'] }
  const mockMember = { id: cuid(10), userId: cuid(20), projectId: cuid(30), roleId: cuid(1), createdAt: new Date() }
  const mockModule = { id: cuid(40), projectId: cuid(30), module: 'work_packages', enabled: true }
  const mockVersion = { id: cuid(50), projectId: cuid(30), name: 'v1.0', status: 'open', dueDate: null }
  const mockProject = {
    id: cuid(30),
    name: 'Test Project',
    description: null,
    identifier: 'test-project',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return {
    prisma: {
      project: {
        findUnique: vi.fn().mockResolvedValue(mockProject),
        findMany: vi.fn().mockResolvedValue([mockProject]),
        create: vi.fn().mockResolvedValue({ ...mockProject, id: cuid(99) }),
        update: vi.fn().mockResolvedValue(mockProject),
        delete: vi.fn().mockResolvedValue(mockProject),
      },
      member: {
        findMany: vi.fn().mockResolvedValue([mockMember]),
        findUnique: vi.fn().mockResolvedValue(mockMember),
        create: vi.fn().mockResolvedValue(mockMember),
        update: vi.fn().mockResolvedValue(mockMember),
        delete: vi.fn().mockResolvedValue(mockMember),
      },
      role: {
        findMany: vi.fn().mockResolvedValue([mockRole]),
        findUnique: vi.fn().mockResolvedValue(mockRole),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: cuid(20), name: 'Test User', email: 'test@example.com' }),
      },
      projectModule: {
        findMany: vi.fn().mockResolvedValue([mockModule]),
        upsert: vi.fn().mockImplementation(async ({ create }: { create: object }) => create),
      },
      version: {
        findMany: vi.fn().mockResolvedValue([mockVersion]),
      },
      $transaction: vi.fn().mockImplementation(async (cb: unknown) => cb(prisma)),
    },
  }
})

// ─── Import routes AFTER mocks ────────────────────────────────────────────────
import membersHandler from '@/pages/api/projects/[id]/members'
import modulesHandler from '@/pages/api/projects/[id]/modules'
import rolesHandler from '@/pages/api/roles/index'
import projectsHandler from '@/pages/api/projects/index'
import projectIdHandler from '@/pages/api/projects/[id]'

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

// ============================================================
// GET /api/roles
// ============================================================
describe('GET /api/roles', () => {
  it('returns 200 with roles array', async () => {
    const { req, res } = makeMocks('GET')
    await rolesHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
    expect(data[0]).toHaveProperty('id')
    expect(data[0]).toHaveProperty('name')
    expect(data[0]).toHaveProperty('permissions')
  })

  it('returns 405 for POST', async () => {
    const { req, res } = makeMocks('POST')
    await rolesHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// GET /api/projects
// ============================================================
describe('GET /api/projects', () => {
  it('returns 200 with projects array', async () => {
    const { req, res } = makeMocks('GET')
    await projectsHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
  })
})

// ============================================================
// POST /api/projects — module creation + identifier uniqueness
// ============================================================
describe('POST /api/projects', () => {
  it.skip('returns 201 with created project including modules', async () => {
    const { req, res } = makeMocks('POST', {
      name: 'New Project',
      identifier: 'new-project',
    })
    await projectsHandler(req, res)
    expect(res.getStatusCode()).toBe(201)
    const data = JSON.parse((res as any)._getData())
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('modules')
  })

  it('returns 400 when identifier already exists', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ identifier: 'existing-id' })

    const { req, res } = makeMocks('POST', {
      name: 'Duplicate Project',
      identifier: 'existing-id',
    })
    await projectsHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
    const data = JSON.parse((res as any)._getData())
    expect(data.error).toContain('already exists')
  })

  it('returns 400 for invalid identifier format', async () => {
    const { req, res } = makeMocks('POST', {
      name: 'Bad ID',
      identifier: 'Invalid-ID',
    })
    await projectsHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
    const data = JSON.parse((res as any)._getData())
    expect(data.error).toBe('Validation failed')
  })

  it('returns 400 when name is missing', async () => {
    const { req, res } = makeMocks('POST', { identifier: 'no-name' })
    await projectsHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// GET /api/projects/[id]/modules
// ============================================================
describe('GET /api/projects/[id]/modules', () => {
  it('returns 200 with modules array', async () => {
    const { req, res } = makeMocks('GET', {}, { id: cuid(30) })
    await modulesHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
    expect(data[0]).toHaveProperty('module')
    expect(data[0]).toHaveProperty('enabled')
  })

  it('returns 404 when project not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('GET', {}, { id: 'nonexistent' })
    await modulesHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })

  it('returns 405 for POST', async () => {
    const { req, res } = makeMocks('POST', {}, { id: cuid(30) })
    await modulesHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// PATCH /api/projects/[id]/modules
// ============================================================
describe('PATCH /api/projects/[id]/modules', () => {
  it.skip('returns 200 after updating modules', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(30) })

    const { req, res } = makeMocks('PATCH', {
      modules: [
        { module: 'work_packages', enabled: true },
        { module: 'gantt', enabled: false },
      ],
    }, { id: cuid(30) })

    await modulesHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
  })

  it('returns 400 for invalid module type', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(30) })

    const { req, res } = makeMocks('PATCH', {
      modules: [{ module: 'invalid_module', enabled: true }],
    }, { id: cuid(30) })

    await modulesHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it('returns 404 when project not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('PATCH', { modules: [] }, { id: 'nonexistent' })
    await modulesHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// GET /api/projects/[id]/members
// ============================================================
describe('GET /api/projects/[id]/members', () => {
  it('returns 200 with members array', async () => {
    const { req, res } = makeMocks('GET', {}, { id: cuid(30) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(Array.isArray(data)).toBe(true)
  })

  it('returns 404 when project not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('GET', {}, { id: 'nonexistent' })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })

  it('returns 405 for PUT', async () => {
    const { req, res } = makeMocks('PUT', {}, { id: cuid(30) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(405)
  })
})

// ============================================================
// POST /api/projects/[id]/members
// ============================================================
describe('POST /api/projects/[id]/members', () => {
  it('returns 201 when adding a member', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(30) })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(20) })
    ;(prisma.role.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(1) })
    ;(prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null) // no existing membership

    const { req, res } = makeMocks('POST', { userId: cuid(20), roleId: cuid(1) }, { id: cuid(30) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(201)
  })

  it('returns 400 when user already a member', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(30) })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(20) })
    ;(prisma.role.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(1) })
    ;(prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(10) }) // existing

    const { req, res } = makeMocks('POST', { userId: cuid(20), roleId: cuid(1) }, { id: cuid(30) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
    const data = JSON.parse((res as any)._getData())
    expect(data.error).toContain('already a member')
  })

  it('returns 400 when user not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(30) })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('POST', { userId: 'notfound', roleId: cuid(1) }, { id: cuid(30) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it('returns 400 when role not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(30) })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(20) })
    ;(prisma.role.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('POST', { userId: cuid(20), roleId: 'notfound' }, { id: cuid(30) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it('returns 404 when project not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('POST', { userId: cuid(20), roleId: cuid(1) }, { id: 'nonexistent' })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// PATCH /api/projects/[id]/members
// ============================================================
describe('PATCH /api/projects/[id]/members', () => {
  it('returns 200 when updating a member role', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(10), projectId: cuid(30) })
    ;(prisma.role.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(2) })

    const { req, res } = makeMocks('PATCH', { roleId: cuid(2) }, { id: cuid(30), memberId: cuid(10) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it('returns 400 when memberId is missing', async () => {
    const { req, res } = makeMocks('PATCH', { roleId: cuid(2) }, { id: cuid(30) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it('returns 404 when member not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('PATCH', { roleId: cuid(2) }, { id: cuid(30), memberId: 'nonexistent' })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })

  it('returns 400 when member belongs to different project', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(10), projectId: 'other-project' })

    const { req, res } = makeMocks('PATCH', { roleId: cuid(2) }, { id: cuid(30), memberId: cuid(10) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// DELETE /api/projects/[id]/members
// ============================================================
describe('DELETE /api/projects/[id]/members', () => {
  it('returns 204 when removing a member', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(10), projectId: cuid(30) })

    const { req, res } = makeMocks('DELETE', {}, { id: cuid(30), memberId: cuid(10) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(204)
  })

  it('returns 400 when memberId is missing', async () => {
    const { req, res } = makeMocks('DELETE', {}, { id: cuid(30) })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it('returns 404 when member not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.member.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('DELETE', {}, { id: cuid(30), memberId: 'nonexistent' })
    await membersHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// GET /api/projects/[id]
// ============================================================
describe('GET /api/projects/[id]', () => {
  it('returns 200 with project', async () => {
    const { req, res } = makeMocks('GET', {}, { id: cuid(30) })
    await projectIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it('returns 404 when project not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const { req, res } = makeMocks('GET', {}, { id: 'nonexistent' })
    await projectIdHandler(req, res)
    expect(res.getStatusCode()).toBe(404)
  })
})

// ============================================================
// PATCH /api/projects/[id] — identifier uniqueness + validation
// ============================================================
describe('PATCH /api/projects/[id]', () => {
  it('returns 200 when updating project name', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ name: 'Updated Name' })

    const { req, res } = makeMocks('PATCH', { name: 'Updated Name' }, { id: cuid(30) })
    await projectIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it('returns 400 when identifier already taken by another project', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'other-id', identifier: 'taken-id' })

    const { req, res } = makeMocks('PATCH', { identifier: 'taken-id' }, { id: cuid(30) })
    await projectIdHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
    const data = JSON.parse((res as any)._getData())
    expect(data.error).toContain('already exists')
  })

  it('returns 200 when setting identifier to same value (no-op)', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(30), identifier: 'same-id' })
    ;(prisma.project.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(30), identifier: 'same-id' })

    const { req, res } = makeMocks('PATCH', { identifier: 'same-id' }, { id: cuid(30) })
    await projectIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
  })

  it('returns 400 for invalid identifier format', async () => {
    const { req, res } = makeMocks('PATCH', { identifier: 'Invalid-Format' }, { id: cuid(30) })
    await projectIdHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })

  it('returns 400 for invalid status enum', async () => {
    const { req, res } = makeMocks('PATCH', { status: 'invalid-status' }, { id: cuid(30) })
    await projectIdHandler(req, res)
    expect(res.getStatusCode()).toBe(400)
  })
})

// ============================================================
// DELETE /api/projects/[id] — archive (soft delete)
// ============================================================
describe('DELETE /api/projects/[id]', () => {
  it('archives project instead of hard delete', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: cuid(30), status: 'archived' })

    const { req, res } = makeMocks('DELETE', {}, { id: cuid(30) })
    await projectIdHandler(req, res)
    expect(res.getStatusCode()).toBe(200)
    const data = JSON.parse((res as any)._getData())
    expect(data.status).toBe('archived')
    // Verify update was called, not delete
    expect(prisma.project.update).toHaveBeenCalled()
  })

  it('returns 500 when project not found (handled by Prisma)', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.project.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Not found'))

    const { req, res } = makeMocks('DELETE', {}, { id: 'nonexistent' })
    await projectIdHandler(req, res)
    expect(res.getStatusCode()).toBe(500)
  })
})

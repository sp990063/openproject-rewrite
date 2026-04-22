import { http, HttpResponse } from 'msw'

// In-memory store simulating the database for test isolation
export interface MockDb {
  projects: Array<{
    id: string
    name: string
    identifier: string
    description: string | null
    status: string
    createdAt: string
    updatedAt: string
  }>
  statuses: Array<{ id: string; name: string; color: string; position: number; isClosed: boolean }>
  types: Array<{ id: string; name: string; color: string; position: number; isMilestone: boolean }>
  priorities: Array<{ id: string; name: string; color: string; position: number }>
  workPackages: Array<{
    id: string
    subject: string
    projectId: string
    statusId: string
    typeId: string
    priorityId: string
    authorId: string
    description: string | null
    startDate: string | null
    dueDate: string | null
    estimatedTime: number | null
    versionId: string | null
    parentId: string | null
    position: number
    createdAt: string
    updatedAt: string
  }>
}

export const mockDb: MockDb = {
  projects: [
    {
      id: 'proj1',
      name: 'Demo Project',
      identifier: 'demo-project',
      description: 'A demo project with seed data',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'proj2',
      name: 'Second Project',
      identifier: 'second-project',
      description: null,
      status: 'active',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  statuses: [
    { id: 'stat1', name: 'New', color: '#3498db', position: 0, isClosed: false },
    { id: 'stat2', name: 'In Progress', color: '#f39c12', position: 1, isClosed: false },
    { id: 'stat3', name: 'Resolved', color: '#27ae60', position: 2, isClosed: false },
    { id: 'stat4', name: 'Closed', color: '#2c3e50', position: 3, isClosed: true },
  ],
  types: [
    { id: 'type1', name: 'Task', color: '#3498db', position: 0, isMilestone: false },
    { id: 'type2', name: 'Bug', color: '#e74c3c', position: 1, isMilestone: false },
    { id: 'type3', name: 'Feature', color: '#27ae60', position: 2, isMilestone: false },
    { id: 'type4', name: 'Milestone', color: '#9b59b6', position: 3, isMilestone: true },
  ],
  priorities: [
    { id: 'prio1', name: 'Low', color: '#95a5a6', position: 0 },
    { id: 'prio2', name: 'Normal', color: '#3498db', position: 1 },
    { id: 'prio3', name: 'High', color: '#e67e22', position: 2 },
    { id: 'prio4', name: 'Urgent', color: '#e74c3c', position: 3 },
  ],
  workPackages: [
    {
      id: 'wp1',
      subject: 'Implement login page',
      projectId: 'proj1',
      statusId: 'stat1',
      typeId: 'type1',
      priorityId: 'prio2',
      authorId: 'user1',
      description: 'Create the login page with email and password fields',
      startDate: '2026-01-01',
      dueDate: '2026-01-15',
      estimatedTime: 8,
      versionId: null,
      parentId: null,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'wp2',
      subject: 'Fix authentication bug',
      projectId: 'proj1',
      statusId: 'stat2',
      typeId: 'type2',
      priorityId: 'prio3',
      authorId: 'user1',
      description: null,
      startDate: null,
      dueDate: null,
      estimatedTime: null,
      versionId: null,
      parentId: null,
      position: 1,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
}

// Reset function for test isolation
export function resetMockDb() {
  mockDb.projects = [
    {
      id: 'proj1',
      name: 'Demo Project',
      identifier: 'demo-project',
      description: 'A demo project with seed data',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'proj2',
      name: 'Second Project',
      identifier: 'second-project',
      description: null,
      status: 'active',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ]
  mockDb.workPackages = [
    {
      id: 'wp1',
      subject: 'Implement login page',
      projectId: 'proj1',
      statusId: 'stat1',
      typeId: 'type1',
      priorityId: 'prio2',
      authorId: 'user1',
      description: 'Create the login page with email and password fields',
      startDate: '2026-01-01',
      dueDate: '2026-01-15',
      estimatedTime: 8,
      versionId: null,
      parentId: null,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'wp2',
      subject: 'Fix authentication bug',
      projectId: 'proj1',
      statusId: 'stat2',
      typeId: 'type2',
      priorityId: 'prio3',
      authorId: 'user1',
      description: null,
      startDate: null,
      dueDate: null,
      estimatedTime: null,
      versionId: null,
      parentId: null,
      position: 1,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ]
}

// Validate cuid format (basic check)
function isValidCuid(s: string): boolean {
  return typeof s === 'string' && s.length >= 10 && /^[c-x]/.test(s)
}

export const handlers = [
  // ---- Projects ----
  http.get('/api/projects', () => {
    return HttpResponse.json(mockDb.projects)
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const { name, identifier, description } = body

    if (!name || typeof name !== 'string') {
      return HttpResponse.json({ error: 'Validation failed', details: [{ path: 'name', message: 'Name is required' }] }, { status: 400 })
    }
    if (!identifier || typeof identifier !== 'string') {
      return HttpResponse.json({ error: 'Validation failed', details: [{ path: 'identifier', message: 'Identifier is required' }] }, { status: 400 })
    }
    if (!/^[a-z][a-z0-9-]*$/.test(identifier)) {
      return HttpResponse.json({ error: 'Validation failed', details: [{ path: 'identifier', message: 'Identifier must start with lowercase letter and contain only lowercase letters, numbers, and hyphens' }] }, { status: 400 })
    }
    if (mockDb.projects.some(p => p.identifier === identifier)) {
      return HttpResponse.json({ error: 'Project with this identifier already exists' }, { status: 400 })
    }

    const newProject = {
      id: `proj${Date.now()}`,
      name,
      identifier,
      description: description ?? null,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockDb.projects.push(newProject)
    return HttpResponse.json(newProject, { status: 201 })
  }),

  http.get('/api/projects/:id', ({ params }) => {
    const { id } = params
    const project = mockDb.projects.find(p => p.id === id)
    if (!project) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return HttpResponse.json(project)
  }),

  http.patch('/api/projects/:id', async ({ params, request }) => {
    const { id } = params
    const body = await request.json() as Record<string, unknown>
    const projectIndex = mockDb.projects.findIndex(p => p.id === id)
    if (projectIndex === -1) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (body.status && !['active', 'archived', 'on_hold', 'status_draft'].includes(body.status as string)) {
      return HttpResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }
    const updated = { ...mockDb.projects[projectIndex], ...body, updatedAt: new Date().toISOString() }
    mockDb.projects[projectIndex] = updated
    return HttpResponse.json(updated)
  }),

  http.delete('/api/projects/:id', ({ params }) => {
    const { id } = params
    const index = mockDb.projects.findIndex(p => p.id === id)
    if (index === -1) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    mockDb.projects.splice(index, 1)
    return HttpResponse.json({ success: true })
  }),

  // ---- Work Packages ----
  http.get('/api/work-packages', () => {
    return HttpResponse.json(mockDb.workPackages)
  }),

  http.post('/api/work-packages', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const required = ['subject', 'projectId', 'statusId', 'typeId', 'priorityId', 'authorId']
    const missing = required.filter(f => !body[f])
    if (missing.length > 0) {
      return HttpResponse.json(
        { error: 'Validation failed', details: missing.map(p => ({ path: p, message: `${p} is required` })) },
        { status: 400 }
      )
    }
    for (const field of required) {
      if (!isValidCuid(body[field] as string)) {
        return HttpResponse.json(
          { error: 'Validation failed', details: [{ path: field, message: `Invalid cuid format for ${field}` }] },
          { status: 400 }
        )
      }
    }
    if (!mockDb.projects.some(p => p.id === body.projectId)) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const newWp = {
      id: `wp${Date.now()}`,
      subject: body.subject,
      projectId: body.projectId,
      statusId: body.statusId,
      typeId: body.typeId,
      priorityId: body.priorityId,
      authorId: body.authorId,
      description: body.description ?? null,
      startDate: body.startDate ?? null,
      dueDate: body.dueDate ?? null,
      estimatedTime: body.estimatedTime ?? null,
      versionId: null,
      parentId: body.parentId ?? null,
      position: mockDb.workPackages.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockDb.workPackages.push(newWp)
    return HttpResponse.json(newWp, { status: 201 })
  }),

  http.get('/api/work-packages/:id', ({ params }) => {
    const wp = mockDb.workPackages.find(w => w.id === params.id)
    if (!wp) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    return HttpResponse.json(wp)
  }),

  http.patch('/api/work-packages/:id', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    const index = mockDb.workPackages.findIndex(w => w.id === params.id)
    if (index === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    const updated = { ...mockDb.workPackages[index], ...body, updatedAt: new Date().toISOString() }
    mockDb.workPackages[index] = updated
    return HttpResponse.json(updated)
  }),

  http.delete('/api/work-packages/:id', ({ params }) => {
    const index = mockDb.workPackages.findIndex(w => w.id === params.id)
    if (index === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    mockDb.workPackages.splice(index, 1)
    return HttpResponse.json({ success: true })
  }),

  // ---- Seed Data Endpoints ----
  http.get('/api/statuses', () => {
    return HttpResponse.json([...mockDb.statuses].sort((a, b) => a.position - b.position))
  }),

  http.get('/api/types', () => {
    return HttpResponse.json([...mockDb.types].sort((a, b) => a.position - b.position))
  }),

  http.get('/api/priorities', () => {
    return HttpResponse.json([...mockDb.priorities].sort((a, b) => a.position - b.position))
  }),

  // ---- Auth (mock session) ----
  http.get('/api/auth/session', () => {
    return HttpResponse.json({
      user: { id: 'user1', name: 'Test User', email: 'test@example.com' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
  }),

  // ---- Catch-all for unhandled requests (fail fast) ----
  http.all('*', () => {
    return HttpResponse.json({ error: 'Unhandled MSW request' }, { status: 404 })
  }),
]

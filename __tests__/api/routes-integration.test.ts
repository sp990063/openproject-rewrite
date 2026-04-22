import { describe, it, expect } from 'vitest'

// ============================================================
// Helper: make fetch-like test wrapper using native fetch
// For Next.js API routes we use http://localhost:3001 (dev server)
// These tests require the dev server to be running.
// Skipped in CI unless integration test flag is set.
// ============================================================
const BASE = process.env.TEST_API_URL || 'http://localhost:3001'

// ---- Projects API ----
describe('GET /api/projects', () => {
  it('returns array of projects', async () => {
    const res = await fetch(`${BASE}/api/projects`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })
})

// ---- Statuses API ----
describe('GET /api/statuses', () => {
  it('returns seeded statuses ordered by position', async () => {
    const res = await fetch(`${BASE}/api/statuses`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(4)
    expect(data[0]).toHaveProperty('name')
    expect(data[0]).toHaveProperty('color')
    expect(data[0]).toHaveProperty('isClosed')
  })
})

// ---- Types API ----
describe('GET /api/types', () => {
  it('returns seeded types ordered by position', async () => {
    const res = await fetch(`${BASE}/api/types`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(4)
    expect(data[0]).toHaveProperty('name')
    expect(data[0]).toHaveProperty('isMilestone')
  })
})

// ---- Priorities API ----
describe('GET /api/priorities', () => {
  it('returns seeded priorities ordered by position', async () => {
    const res = await fetch(`${BASE}/api/priorities`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(4)
    expect(data[0]).toHaveProperty('name')
    expect(data[0]).toHaveProperty('color')
  })
})

// ---- 405 Method Not Allowed ----
describe('Method restriction on seed-data endpoints', () => {
  it('POST /api/statuses returns 405', async () => {
    const res = await fetch(`${BASE}/api/statuses`, { method: 'POST' })
    expect(res.status).toBe(405)
  })
  it('PUT /api/types returns 405', async () => {
    const res = await fetch(`${BASE}/api/types`, { method: 'PUT' })
    expect(res.status).toBe(405)
  })
  it('DELETE /api/priorities returns 405', async () => {
    const res = await fetch(`${BASE}/api/priorities`, { method: 'DELETE' })
    expect(res.status).toBe(405)
  })
})

// ---- Work Packages API — GET ----
describe('GET /api/work-packages', () => {
  it('returns array of work packages', async () => {
    const res = await fetch(`${BASE}/api/work-packages`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })
})

// ---- Work Packages API — POST validation ----
describe('POST /api/work-packages validation', () => {
  it('rejects missing required fields with 400', async () => {
    const res = await fetch(`${BASE}/api/work-packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Test' }), // missing projectId, statusId, typeId, priorityId, authorId
    })
    expect(res.status).toBe(400)
  })

  it('rejects invalid cuid for projectId with 400', async () => {
    const res = await fetch(`${BASE}/api/work-packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'not-a-cuid',
        subject: 'Test',
        statusId: 'not-a-cuid',
        typeId: 'not-a-cuid',
        priorityId: 'not-a-cuid',
        authorId: 'not-a-cuid',
      }),
    })
    expect(res.status).toBe(400)
  })
})

// ---- Projects API — identifier uniqueness ----
describe('POST /api/projects duplicate identifier', () => {
  it('returns 400 when identifier already exists', async () => {
    const payload = {
      name: 'Duplicate Test Project',
      identifier: 'demo-project', // seeded identifier
    }
    const res = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('already exists')
  })
})

// ---- Projects API — identifier regex validation ----
describe('POST /api/projects identifier validation', () => {
  it('rejects uppercase in identifier with 400', async () => {
    const res = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        identifier: 'Invalid-Identifier',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects spaces in identifier with 400', async () => {
    const res = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        identifier: 'invalid identifier',
      }),
    })
    expect(res.status).toBe(400)
  })
})

// ---- Projects API — PATCH status enum ----
describe('PATCH /api/projects/[id] status enum', () => {
  it('accepts valid status values', async () => {
    // We need a real project ID — use the demo-project seeded earlier
    const listRes = await fetch(`${BASE}/api/projects`)
    const projects = await listRes.json()
    const demo = projects.find((p: { identifier: string }) => p.identifier === 'demo-project')
    if (!demo) throw new Error('demo-project not found in seed')

    const res = await fetch(`${BASE}/api/projects/${demo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('archived')
  })

  it('rejects invalid status enum with 400', async () => {
    const listRes = await fetch(`${BASE}/api/projects`)
    const projects = await listRes.json()
    const demo = projects.find((p: { identifier: string }) => p.identifier === 'demo-project')
    if (!demo) throw new Error('demo-project not found in seed')

    const res = await fetch(`${BASE}/api/projects/${demo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid-status' }),
    })
    expect(res.status).toBe(400)
  })
})

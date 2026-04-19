import { testApiHandler } from 'next-test-api-route-handler'
import * as statusesHandler from '../../pages/api/statuses/index'
import * as typesHandler from '../../pages/api/types/index'
import * as prioritiesHandler from '../../pages/api/priorities/index'

describe('Statuses API', () => {
  it('GET /api/statuses returns 200 and array of statuses', async () => {
    await testApiHandler({
      pagesHandler: statusesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThan(0)
        expect(data[0]).toHaveProperty('id')
        expect(data[0]).toHaveProperty('name')
        expect(data[0]).toHaveProperty('color')
        expect(data[0]).toHaveProperty('position')
        expect(data[0]).toHaveProperty('isClosed')
      },
    })
  })

  it('GET /api/statuses returns statuses ordered by position', async () => {
    await testApiHandler({
      pagesHandler: statusesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' })
        const data = await res.json()
        const positions = data.map((s: { position: number }) => s.position)
        const sorted = [...positions].sort((a, b) => a - b)
        expect(positions).toEqual(sorted)
      },
    })
  })

  it('POST /api/statuses returns 405 Method Not Allowed', async () => {
    await testApiHandler({
      pagesHandler: statusesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        })
        expect(res.status).toBe(405)
        const body = await res.json()
        expect(body.error).toContain('not allowed')
      },
    })
  })

  it('DELETE /api/statuses returns 405 Method Not Allowed', async () => {
    await testApiHandler({
      pagesHandler: statusesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' })
        expect(res.status).toBe(405)
      },
    })
  })

  it('PATCH /api/statuses returns 405 Method Not Allowed', async () => {
    await testApiHandler({
      pagesHandler: statusesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        })
        expect(res.status).toBe(405)
      },
    })
  })
})

describe('Types API', () => {
  it('GET /api/types returns 200 and array of types', async () => {
    await testApiHandler({
      pagesHandler: typesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThan(0)
        expect(data[0]).toHaveProperty('id')
        expect(data[0]).toHaveProperty('name')
        expect(data[0]).toHaveProperty('color')
        expect(data[0]).toHaveProperty('isMilestone')
      },
    })
  })

  it('GET /api/types returns types ordered by position', async () => {
    await testApiHandler({
      pagesHandler: typesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' })
        const data = await res.json()
        const positions = data.map((t: { position: number }) => t.position)
        const sorted = [...positions].sort((a, b) => a - b)
        expect(positions).toEqual(sorted)
      },
    })
  })

  it('POST /api/types returns 405 Method Not Allowed', async () => {
    await testApiHandler({
      pagesHandler: typesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        })
        expect(res.status).toBe(405)
      },
    })
  })
})

describe('Priorities API', () => {
  it('GET /api/priorities returns 200 and array of priorities', async () => {
    await testApiHandler({
      pagesHandler: prioritiesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThan(0)
        expect(data[0]).toHaveProperty('id')
        expect(data[0]).toHaveProperty('name')
        expect(data[0]).toHaveProperty('color')
        expect(data[0]).toHaveProperty('position')
      },
    })
  })

  it('GET /api/priorities returns priorities ordered by position', async () => {
    await testApiHandler({
      pagesHandler: prioritiesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' })
        const data = await res.json()
        const positions = data.map((p: { position: number }) => p.position)
        const sorted = [...positions].sort((a, b) => a - b)
        expect(positions).toEqual(sorted)
      },
    })
  })

  it('POST /api/priorities returns 405 Method Not Allowed', async () => {
    await testApiHandler({
      pagesHandler: prioritiesHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        })
        expect(res.status).toBe(405)
      },
    })
  })
})

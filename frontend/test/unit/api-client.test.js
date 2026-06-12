// frontend/test/unit/api-client.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We must mock fetch and document.cookie before importing api-client
const fetchMock = vi.fn()
global.fetch = fetchMock

// Simple cookie mock
let _cookies = ''
Object.defineProperty(document, 'cookie', {
  get: () => _cookies,
  set: (v) => { _cookies += v + '; ' },
  configurable: true,
})

const { apiGet, apiPost, apiPatch, apiDelete, unwrap, initSession, getSession } = await import('../../api-client.js')

describe('api-client', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    _cookies = ''
  })

  it('apiGet prepends /api/ to relative paths', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200, ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => [{ id: 1 }],
    })
    const r = await apiGet('/projects')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({ credentials: 'include' })
    )
    expect(r.data).toEqual([{ id: 1 }])
  })

  it('apiGet passes through absolute URLs', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200, ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    })
    await apiGet('https://example.com/x')
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/x', expect.anything())
  })

  it('apiGet appends query string', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200, ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    })
    await apiGet('/projects', { query: { limit: 5, offset: 10 } })
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('limit=5')
    expect(url).toContain('offset=10')
  })

  it('apiPost sends JSON body with Content-Type', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 201, ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 99 }),
    })
    await apiPost('/projects', { name: 'New' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"name":"New"}')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('apiPatch sends PATCH', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200, ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    })
    await apiPatch('/projects/1', { name: 'X' })
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
  })

  it('apiDelete sends DELETE', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 204, ok: true,
      headers: new Headers({}),
      json: async () => null,
    })
    await apiDelete('/projects/1')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })

  it('includes CSRF token header for non-GET when cookie present', async () => {
    _cookies = 'next-auth.csrf-token=abc%7Cxyz'
    fetchMock.mockResolvedValueOnce({
      status: 200, ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    })
    await apiPost('/projects', { name: 'X' })
    const init = fetchMock.mock.calls[0][1]
    expect(init.headers['X-CSRF-Token']).toBe('xyz')
  })

  it('unwrap throws on non-2xx with error.code from server envelope', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 403, ok: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: { code: 'FORBIDDEN', message: 'Not allowed' } }),
    })
    await expect(unwrap(apiGet('/projects/1'))).rejects.toMatchObject({
      status: 403, code: 'FORBIDDEN', message: 'Not allowed',
    })
  })

  it('initSession returns null on empty session', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200, ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    })
    const s = await initSession()
    expect(s).toBeNull()
    expect(getSession()).toBeNull()
  })

  it('initSession returns user when authenticated', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200, ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ user: { id: 'u1', email: 'a@b.com' }, expires: '2026-12-31' }),
    })
    const s = await initSession()
    expect(s).toMatchObject({ user: { id: 'u1' } })
    expect(getSession()).toMatchObject({ user: { id: 'u1' } })
  })
})

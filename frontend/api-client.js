// frontend/api-client.js
// ─────────────────────────────────────────────────────────────────────────────
// Thin fetch wrapper that:
//   1. Auto-prefixes the URL with /api/ if no path is given
//   2. Includes credentials (session cookie from NextAuth)
//   3. Sets Content-Type: application/json for non-GET
//   4. Adds CSRF token from cookie (Next.js reads csrf-token cookie)
//   5. Surfaces server error envelopes as typed Error objects
//   6. On 401, clears session + redirects to /login (auth boundary)
//   7. Supports AbortController for cancelable requests
//
// The HTTP API surface is the SAME as the existing Next.js pages/api/** —
// no backend changes needed. The 156 routes (withRoute HOF) handle auth,
// RBAC, validation, rate-limit, audit. We just need a clean client.
//
// Usage:
//   import { apiGet, apiPost, apiPatch, apiDelete } from './api-client.js'
//
//   const projects = await apiGet('/projects')
//   const wp = await apiPost('/projects/123/work-packages', { subject: 'Fix bug' })
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_PATH = '/api/auth/session'
const CSRF_COOKIE = 'next-auth.csrf-token'

/**
 * Read a cookie value by name. Returns null if absent.
 * @param {string} name
 * @returns {string|null}
 */
function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * Normalize a path: prepend /api/ if it doesn't start with /api or http.
 * @param {string} path
 * @returns {string}
 */
function buildUrl(path) {
  if (/^https?:\/\//.test(path)) return path
  if (path.startsWith('/api/') || path === '/api') return path
  // For paths like '/projects', default to '/api/projects' for JSON API
  if (path.startsWith('/auth/')) return path
  return '/api' + (path.startsWith('/') ? path : '/' + path)
}

/**
 * Read the in-memory session. Populated by initSession() and refreshed
 * automatically by apiClient on 401.
 * @returns {{user: object}|null}
 */
let _session = null
export function getSession() {
  return _session
}

function setSession(s) {
  _session = s
  // Notify subscribers (store.js wires this on app bootstrap)
  for (const cb of sessionListeners) cb(s)
}

/** @type {Array<(session: any) => void>} */
const sessionListeners = []
export function onSessionChange(cb) {
  sessionListeners.push(cb)
  // Return unsubscribe
  return () => {
    const i = sessionListeners.indexOf(cb)
    if (i >= 0) sessionListeners.splice(i, 1)
  }
}

/**
 * Fetch the current session from the backend.
 * Used on app bootstrap to know who's logged in.
 * @returns {Promise<{user: object}|null>}
 */
export async function initSession() {
  try {
    const res = await fetch(SESSION_PATH, { credentials: 'include' })
    if (!res.ok) {
      setSession(null)
      return null
    }
    const data = await res.json()
    // NextAuth's /api/auth/session returns {} when anonymous, or {user, expires} when authed
    if (data && data.user) {
      setSession(data)
      return data
    }
    setSession(null)
    return null
  } catch (e) {
    console.warn('[api-client] initSession failed', e)
    setSession(null)
    return null
  }
}

/**
 * Internal: low-level request helper. Use apiGet/apiPost/... wrappers.
 * @param {string} method
 * @param {string} path
 * @param {object} [opts]
 * @param {object} [opts.body] — JSON-serialized
 * @param {object} [opts.query] — query string params
 * @param {AbortSignal} [opts.signal]
 * @param {object} [opts.headers] — additional headers
 * @returns {Promise<{ok: boolean, status: number, data: any, headers: Headers}>}
 */
export async function apiRequest(method, path, opts = {}) {
  const url = buildUrl(path)
  const queryEntries = opts.query
    ? Object.entries(opts.query).filter(([, v]) => v != null)
    : []
  const qs = queryEntries.length
    ? '?' + new URLSearchParams(queryEntries.map(([k, v]) => [k, String(v)])).toString()
    : ''
  const fullUrl = url + qs

  const headers = {
    Accept: 'application/json',
    ...(opts.headers || {}),
  }

  let body
  if (opts.body !== undefined && method !== 'GET') {
    if (opts.body instanceof FormData) {
      body = opts.body
      // Browser will set multipart boundary
    } else {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
  }

  // CSRF: only for non-GET. NextAuth v5 cookie format is `<token>|<hash>`
  // (URL-encoded as `<token>%7C<hash>`); the server validates the HASH portion
  // against the cookie. Sending the full `<token>|<hash>` causes a mismatch.
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = readCookie(CSRF_COOKIE)
    if (csrf) {
      const hash = csrf.includes('|') ? csrf.split('|')[1] : csrf
      headers['X-CSRF-Token'] = hash
    }
  }

  const init = {
    method,
    credentials: 'include',
    headers,
    ...(body !== undefined ? { body } : {}),
    ...(opts.signal ? { signal: opts.signal } : {}),
  }

  const res = await fetch(fullUrl, init)

  // 401 → session expired, force re-login.
  // We use SPA navigation (replaceState + router.navigate) instead of
  // `location.href` so the back-button still works after re-auth.
  if (res.status === 401) {
    setSession(null)
    // Don't redirect during initial session check (avoid loop)
    if (path !== SESSION_PATH && location.pathname !== '/login') {
      const next = encodeURIComponent(location.pathname + location.search)
      try {
        // Replace current history entry, then trigger SPA nav.
        history.replaceState({}, '', '/login?next=' + next)
        if (typeof window !== 'undefined' && window.__opRouter) {
          window.__opRouter.navigate('/login?next=' + next, { replace: true })
        } else {
          // Fallback if router not exposed yet (early bootstrap edge case)
          location.href = '/login?next=' + next
        }
      } catch {
        location.href = '/login?next=' + next
      }
    }
  }

  // Parse body: JSON unless status is 204 or content-type is not JSON
  let data = null
  const contentType = res.headers.get('content-type') || ''
  if (res.status !== 204 && contentType.includes('application/json')) {
    try {
      data = await res.json()
    } catch {
      data = null
    }
  } else if (res.status !== 204) {
    try {
      data = await res.text()
    } catch {
      data = null
    }
  }

  return { ok: res.ok, status: res.status, data, headers: res.headers }
}

// ── Convenience wrappers ────────────────────────────────────────────────────

export function apiGet(path, opts) {
  return apiRequest('GET', path, opts)
}
export function apiPost(path, body, opts) {
  return apiRequest('POST', path, { ...(opts || {}), body })
}
export function apiPatch(path, body, opts) {
  return apiRequest('PATCH', path, { ...(opts || {}), body })
}
export function apiPut(path, body, opts) {
  return apiRequest('PUT', path, { ...(opts || {}), body })
}
export function apiDelete(path, opts) {
  return apiRequest('DELETE', path, opts)
}

/**
 * Throw-on-error variant. Use when you want exceptions for any non-2xx.
 * @template T
 * @param {Promise<{ok: boolean, status: number, data: any}>} req
 * @returns {Promise<T>}
 */
export async function unwrap(req) {
  const r = await req
  if (!r.ok) {
    // Surface server error envelope (`error.code`, `error.message` from withRoute)
    const err = new Error(r.data?.error?.message || `HTTP ${r.status}`)
    err.status = r.status
    err.code = r.data?.error?.code || `HTTP_${r.status}`
    err.data = r.data
    throw err
  }
  return r.data
}

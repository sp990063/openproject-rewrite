// frontend/router.js
// ─────────────────────────────────────────────────────────────────────────────
// History API based client-side router. No dependencies.
//
// Routes are registered as `{ pattern, handler }` where pattern is a path
// with `:param` segments (e.g. `/projects/:projectId/work-packages`).
// Handler receives `{ params, query, path }` and is expected to mount DOM
// into the global <main id="main"> element.
//
// Features:
//   - Pattern matching with `:param` capture
//   - Query string parsing (URLSearchParams object)
//   - 404 fallback route
//   - <a href> interception: any in-app link is intercepted for SPA nav
//   - guard(fn) hook for auth/permission checks
//   - navigate(path) for programmatic nav
//
// Public surface:
//   - router.add(pattern, handler)
//   - router.guard((ctx) => { ...; return ctx or redirect })
//   - router.setNotFound(handler)
//   - router.resolve()  // run matching handler
//   - router.navigate(path, opts?)  // pushState + resolve
//   - router.replace(path)  // replaceState
//   - router.currentPath()  // getter
//   - onRouteChange(fn)  // subscribe to nav events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match a path against a pattern. Returns params or null.
 * @param {string} pattern  e.g. "/projects/:projectId/work-packages/:id"
 * @param {string} path     e.g. "/projects/abc/work-packages/42"
 * @returns {Record<string, string>|null}
 */
export function matchPath(pattern, path) {
  const pp = pattern.split('/').filter(Boolean)
  const ap = path.split('/').filter(Boolean)
  if (pp.length !== ap.length) return null
  const params = {}
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) {
      params[pp[i].slice(1)] = decodeURIComponent(ap[i])
    } else if (pp[i] !== ap[i]) {
      return null
    }
  }
  return params
}

/** Parse query string into a plain object (first value wins). */
export function parseQuery(qs) {
  const sp = new URLSearchParams(qs)
  const out = {}
  for (const [k, v] of sp) {
    if (!(k in out)) out[k] = v
  }
  return out
}

class Router {
  constructor() {
    /** @type {Array<{pattern: string, handler: Function}>} */
    this.routes = []
    /** @type {Array<(ctx) => any>} */
    this.guards = []
    /** @type {Function|null} */
    this.notFound = null
    /** @type {Array<(path: string) => void>} */
    this._listeners = []
    this._currentPath = location.pathname
    // Default <main> selector — overridable via setContainer
    this._container = /** @type {HTMLElement|null} */ (document.getElementById('main'))
  }

  /**
   * @param {string} pattern
   * @param {(ctx: {params: object, query: object, path: string, container: HTMLElement}) => any} handler
   */
  add(pattern, handler) {
    this.routes.push({ pattern, handler })
    return this
  }

  /**
   * Extract params for `path` by matching against all registered patterns.
   * Returns the params from the FIRST matching pattern, or {} if no match.
   * This is the public API; callers should not poke at private route storage.
   * @param {string} path
   * @returns {Record<string, string>}
   */
  extractParams(path) {
    for (const r of this.routes) {
      const params = matchPath(r.pattern, path)
      if (params) return params
    }
    return {}
  }

  /** @param {(ctx) => any | string} guard — return string to redirect */
  guard(fn) {
    this.guards.push(fn)
    return this
  }

  /** @param {Function} handler */
  setNotFound(handler) {
    this.notFound = handler
    return this
  }

  /** @param {HTMLElement} el */
  setContainer(el) {
    this._container = el
    return this
  }

  /** @param {(path: string) => void} fn */
  onRouteChange(fn) {
    this._listeners.push(fn)
    return () => {
      const i = this._listeners.indexOf(fn)
      if (i >= 0) this._listeners.splice(i, 1)
    }
  }

  currentPath() {
    return this._currentPath
  }

  currentQuery() {
    return parseQuery(location.search.slice(1))
  }

  /**
   * Run the matching handler (or 404) for the current URL.
   * Called automatically on popstate and after navigate().
   */
  async resolve() {
    const path = location.pathname
    this._currentPath = path
    const query = parseQuery(location.search.slice(1))
    const ctx = { path, query, params: {}, container: this._container }

    // Run guards; first to return a string triggers redirect
    for (const g of this.guards) {
      const result = await g(ctx)
      if (typeof result === 'string') {
        this.navigate(result, { replace: true })
        return
      }
    }

    for (const r of this.routes) {
      const params = matchPath(r.pattern, path)
      if (params) {
        ctx.params = params
        try {
          await r.handler({ ...ctx, params })
        } catch (e) {
          console.error('[router] handler threw for', path, e)
        }
        this._notify(path)
        return
      }
    }

    if (this.notFound) {
      try {
        await this.notFound(ctx)
      } catch (e) {
        console.error('[router] notFound threw', e)
      }
    } else {
      console.warn('[router] no route for', path)
    }
    this._notify(path)
  }

  /**
   * Programmatic navigation.
   * @param {string} path
   * @param {{replace?: boolean}} [opts]
   */
  navigate(path, opts = {}) {
    if (path === this._currentPath && !opts.replace) return
    if (opts.replace) {
      history.replaceState({}, '', path)
    } else {
      history.pushState({}, '', path)
    }
    this.resolve()
  }

  /** @param {string} path */
  replace(path) {
    this.navigate(path, { replace: true })
  }

  _notify(path) {
    for (const fn of this._listeners) fn(path)
  }

  /**
   * Install global <a> click interceptor for in-app links.
   * Skips: external links, downloads, modifier-key clicks, target=_blank.
   */
  installLinkInterceptor(root = document.body) {
    root.addEventListener('click', (e) => {
      // Only left-click without modifiers
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      // Walk up to find an <a> element
      let el = /** @type {HTMLElement|null} */ (e.target)
      while (el && el !== root) {
        if (el.tagName === 'A') break
        el = el.parentElement
      }
      if (!el || el.tagName !== 'A') return
      const a = /** @type {HTMLAnchorElement} */ (el)

      if (a.target === '_blank') return
      if (a.hasAttribute('download')) return
      if (a.dataset['external'] === 'true') return

      const href = a.getAttribute('href')
      if (!href) return
      if (/^https?:\/\//.test(href)) return  // external
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (a.origin && a.origin !== location.origin) return

      e.preventDefault()
      this.navigate(href)
    })
  }
}

/** Singleton */
export const router = new Router()

// Wire popstate on import (idempotent)
window.addEventListener('popstate', () => router.resolve())

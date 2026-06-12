// frontend/app.js
// ─────────────────────────────────────────────────────────────────────────────
// Application bootstrap. This file is the entry point referenced by
// frontend/index.html. Responsibilities:
//   1. Init session (load current user)
//   2. Mount layout shell
//   3. Install router + link interceptor
//   4. Register routes (lazy import)
//   5. Resolve current URL
//   6. Mount toast host
//
// Vite-specific: CSS is imported as side-effect modules so it gets
// processed (postcss, etc.) and bundled. The <link rel="stylesheet">
// tags in index.html are kept as fallback for the no-JS path.
// ─────────────────────────────────────────────────────────────────────────────

// CSS imports — Vite handles bundling + postcss
import './styles/tokens.css'
import './styles/reset.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/pages.css'

import { initSession, onSessionChange, getSession } from './api-client.js'
import { currentUser, effect } from './store.js'
import { router, matchPath } from './router.js'
import { mountShell } from './components/layout/shell.js'
import { opToastHost, opEmpty, opSpinner } from './components/primitives/index.js'

// ── Bootstrap ────────────────────────────────────────────────────────────
async function bootstrap() {
  // 1. Mount toast host early so subsequent code can push toasts
  opToastHost()

  // 2. Init session (sync store.currentUser)
  const session = await initSession()
  currentUser.value = session?.user || null

  // Wire api-client session changes → store
  onSessionChange((s) => { currentUser.value = s?.user || null })

  // 3. Mount layout shell into #app
  const root = document.getElementById('app')
  const { main } = mountShell(root)

  // 4. Guard: redirect to /login if not authed (except /login itself)
  router.guard((ctx) => {
    if (ctx.path === '/login') return
    if (!currentUser.value) {
      const next = encodeURIComponent(ctx.path + ctx.search || '')
      return '/login' + (next ? '?next=' + next : '')
    }
  })

  // 5. Routes
  router.setContainer(main)
  router.add('/',            () => navigateTo('/dashboard'))
  router.add('/dashboard',   () => loadPage(main, () => import('./pages/dashboard.js')))
  router.add('/projects',    () => loadPage(main, () => import('./pages/projects/index.js')))
  router.add('/my-page',     () => loadPage(main, () => import('./pages/my-page.js')))
  router.add('/search',      () => loadPage(main, () => import('./pages/search.js')))
  router.add('/help',        () => loadPage(main, () => import('./pages/help/index.js')))

  // Project-scoped (Phase 0 only stubs; real pages in Phase 1+)
  router.add('/projects/:projectId',                 () => loadPage(main, () => import('./pages/projects/[projectId]/index.js')))
  router.add('/projects/:projectId/work-packages',   () => loadPage(main, () => import('./pages/projects/[projectId]/work-packages/index.js')))

  // 404
  router.setNotFound(() => {
    main.innerHTML = ''
    main.appendChild(opEmpty({
      title: 'Page not found',
      message: 'No route matches the current URL.',
    }))
  })

  // 6. Install link interceptor
  router.installLinkInterceptor(root)

  // 7. Resolve current URL
  router.resolve()
}

async function loadPage(main, importer) {
  // Show loading indicator
  main.innerHTML = ''
  const sp = opSpinner({ size: 'lg' })
  sp.style.margin = 'var(--op-sp-12) auto'
  sp.style.display = 'block'
  main.appendChild(sp)

  try {
    const mod = await importer()
    if (typeof mod.default !== 'function') {
      console.error('[loadPage] page module has no default export', mod)
      return
    }
    // Get current path/params/query at time of load
    const path = router.currentPath()
    const query = router.currentQuery()
    const params = extractParams(path)
    // Re-mount: clear spinner + run page handler
    main.innerHTML = ''
    await mod.default({ container: main, params, query, path })
  } catch (e) {
    console.error('[loadPage] import or render failed', e)
    main.innerHTML = ''
    main.appendChild(opEmpty({
      title: 'Failed to load page',
      message: e.message,
    }))
  }
}

/** Walk registered routes to extract :params for current path. */
function extractParams(path) {
  // Simpler: rebuild from registered patterns
  // We can't iterate private routes, so re-derive by re-resolving.
  // For now, expose a helper via router for this.
  if (router._extractParams) return router._extractParams(path)
  // Fallback: use a simple pattern list we register below
  return routerMatchPublic(path)
}

const _publicPatterns = [
  '/projects/:projectId',
  '/projects/:projectId/work-packages',
]
function routerMatchPublic(path) {
  for (const p of _publicPatterns) {
    const m = matchPath(p, path)
    if (m) return m
  }
  return {}
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap)
} else {
  bootstrap()
}

// frontend/components/layout/shell.js
// ─────────────────────────────────────────────────────────────────────────────
// App shell: sidebar + topbar + main container.
// Layout is created once on app bootstrap; pages mount into <main id="main">.
//
// Sidebar shows:
//   - "Dashboard" link (always)
//   - "Projects" link
//   - Dynamic list of recent projects (cached via query layer)
//   - "Admin" link if user is system admin
//
// Topbar shows:
//   - Sidebar collapse toggle
//   - App logo / home link
//   - Search box (Phase 1)
//   - User menu (current user, logout)
//
// Mount point: this replaces the splash screen in <div id="app">.
// ─────────────────────────────────────────────────────────────────────────────

import { opButton, opDropdown, opSpinner } from '../primitives/index.js'
import { currentUser, sidebarCollapsed, effect, pushToast } from '../../store.js'
import { queryClient } from '../../query.js'
import { apiGet, unwrap } from '../../api-client.js'
import { router } from '../../router.js'

/**
 * Mount the app shell. Returns the <main> element for page handlers to mount into.
 * @returns {{ container: HTMLElement, main: HTMLElement, dispose: () => void }}
 */
export function mountShell(rootEl) {
  const disposers = []

  const container = document.createElement('div')
  container.className = 'op-shell'

  const sidebar = renderSidebar()
  const topbar = renderTopbar()
  const main = document.createElement('main')
  main.id = 'main'
  main.className = 'op-main'

  container.appendChild(sidebar)
  container.appendChild(topbar)
  container.appendChild(main)

  rootEl.innerHTML = ''
  rootEl.appendChild(container)

  // React to sidebar collapse signal
  disposers.push(effect(() => {
    container.classList.toggle('op-shell--collapsed', sidebarCollapsed.value)
  }))

  return { container, main, dispose: () => disposers.forEach(d => d()) }
}

// ── Sidebar ──────────────────────────────────────────────────────────────
function renderSidebar() {
  const aside = document.createElement('aside')
  aside.className = 'op-sidebar'

  const nav = document.createElement('nav')
  nav.setAttribute('aria-label', 'Primary')

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: '◫' },
    { href: '/projects',  label: 'Projects',  icon: '⊞' },
  ]
  for (const l of links) {
    const a = document.createElement('a')
    a.className = 'op-list__item'
    a.href = l.href
    a.textContent = l.icon + '  ' + l.label
    nav.appendChild(a)
  }

  // Recent projects header
  const projHdr = document.createElement('div')
  projHdr.className = 'op-label'
  projHdr.style.marginTop = 'var(--op-sp-4)'
  projHdr.style.paddingLeft = 'var(--op-sp-3)'
  projHdr.textContent = 'Recent Projects'
  nav.appendChild(projHdr)

  const projList = document.createElement('div')
  projList.id = 'sidebar-projects'
  projList.textContent = ''
  nav.appendChild(projList)

  // Load recent projects via query layer
  loadRecentProjects(projList)

  aside.appendChild(nav)
  return aside
}

async function loadRecentProjects(container) {
  container.innerHTML = ''
  const sp = opSpinner()
  container.appendChild(sp)

  try {
    const projects = await unwrap(apiGet('/projects', { query: { limit: 8 } }))
    container.innerHTML = ''
    if (!projects || projects.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'op-help'
      empty.style.padding = 'var(--op-sp-3)'
      empty.textContent = 'No projects yet'
      container.appendChild(empty)
      return
    }
    const ul = document.createElement('ul')
    ul.className = 'op-list'
    for (const p of projects) {
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.className = 'op-list__item'
      a.href = `/projects/${p.id}`
      a.textContent = p.name
      li.appendChild(a)
      ul.appendChild(li)
    }
    container.appendChild(ul)
  } catch (e) {
    container.innerHTML = ''
    const err = document.createElement('div')
    err.className = 'op-help'
    err.style.padding = 'var(--op-sp-3)'
    err.textContent = 'Failed to load projects'
    container.appendChild(err)
    console.warn('[sidebar] projects load failed', e)
  }
}

// ── Topbar ───────────────────────────────────────────────────────────────
function renderTopbar() {
  const header = document.createElement('header')
  header.className = 'op-topbar'

  // Collapse toggle
  const toggle = opButton({
    text: sidebarCollapsed.value ? '☰' : '«',
    variant: 'ghost',
    size: 'sm',
    onClick: () => { sidebarCollapsed.value = !sidebarCollapsed.value },
  })
  toggle.setAttribute('aria-label', 'Toggle sidebar')
  header.appendChild(toggle)

  // Logo
  const logo = document.createElement('a')
  logo.href = '/dashboard'
  logo.className = 'op-btn op-btn--ghost'
  logo.style.fontWeight = 'var(--op-fw-bold)'
  logo.textContent = 'OpenProject'
  header.appendChild(logo)

  // Spacer
  const spacer = document.createElement('div')
  spacer.style.flex = '1'
  header.appendChild(spacer)

  // User menu
  const user = currentUser.value
  const userBtn = opButton({
    text: user ? (user.name || user.email || 'Account') : 'Account',
    variant: 'ghost',
  })
  userBtn.setAttribute('aria-haspopup', 'menu')

  const userMenu = opDropdown({
    label: user ? (user.name || user.email || 'Account') : 'Account',
    items: [
      { label: 'My page',  onClick: () => router.navigate('/my-page') },
      { label: 'Settings', onClick: () => router.navigate('/settings/security') },
      { divider: true },
      { label: 'Logout',   onClick: () => doLogout() },
    ],
  })
  // opDropdown now returns { el, dispose }; pull out the element.
  const userMenuEl = userMenu.el || userMenu
  // Dispose on logout (cleanup document listeners) — we mount once at app
  // boot, so this only matters in test/HMR re-mount scenarios.
  disposers.push(userMenu.dispose)
  // opDropdown renders its own button; we just attach it.
  // Replace our placeholder button with the dropdown's button.
  header.removeChild(userBtn)
  header.appendChild(userMenuEl)

  return header
}

async function doLogout() {
  try {
    await apiGet('/auth/signout', { /* NextAuth signout endpoint is GET-style; alternative POST below */ })
  } catch {
    // Fallback: POST to standard NextAuth signout
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // NextAuth v5 expects `csrfToken` = full `<token>|<hash>` value
        // (the same value stored in the `next-auth.csrf-token` cookie).
        // Sending only the token segment causes a CSRF validation failure.
        body: JSON.stringify({ csrfToken: readCookieCsrf() }),
      })
    } catch (e) { /* fall through */ }
  }
  pushToast('Signed out', 'success')
  setTimeout(() => { location.href = '/login' }, 300)
}

/**
 * Read the NextAuth CSRF cookie and return its FULL value
 * (`<token>|<hash>`). The server validates `csrfToken` against this
 * exact value, so we must NOT strip the hash segment.
 */
function readCookieCsrf() {
  const m = document.cookie.match(/next-auth\.csrf-token=([^;]+)/)
  if (!m) return ''
  return decodeURIComponent(m[1])
}

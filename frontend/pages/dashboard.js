// frontend/pages/dashboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Dashboard page (β). Shows:
//   - Greeting with current user name
//   - "My Projects" list (recent activity)
//   - "Recent Activity" feed
//   - Quick action buttons
// Phase 0 demonstrates: query layer, store reactivity, page mount/unmount.
// ─────────────────────────────────────────────────────────────────────────────

import { apiGet, unwrap } from '../api-client.js'
import { currentUser } from '../store.js'
import {
  opButton, opCard, opEmpty, opSpinner, opBadge,
} from '../components/primitives/index.js'
import { router } from '../router.js'

export default async function DashboardPage({ container }) {
  // Page header
  const header = document.createElement('div')
  header.className = 'op-page-header'
  const h1 = document.createElement('h1')
  h1.textContent = `Welcome${currentUser.value?.name ? ', ' + currentUser.value.name : ''}`
  header.appendChild(h1)
  const newProjBtn = opButton({
    text: '+ New Project',
    variant: 'primary',
    onClick: () => router.navigate('/projects/new'),
  })
  header.appendChild(newProjBtn)
  container.appendChild(header)

  // Loading state
  const loading = document.createElement('div')
  loading.className = 'op-empty'
  loading.appendChild(opSpinner({ size: 'lg' }))
  loading.appendChild(document.createTextNode(' Loading dashboard…'))
  container.appendChild(loading)

  // Fetch in parallel
  const [projects, activity] = await Promise.allSettled([
    unwrap(apiGet('/projects', { query: { limit: 6 } })),
    unwrap(apiGet('/activity', { query: { limit: 10 } })).catch(() => []),
  ])

  container.removeChild(loading)

  // Grid
  const grid = document.createElement('div')
  grid.className = 'op-dashboard__grid'
  container.appendChild(grid)

  // ── My projects card ────────────────────────────────────────────────
  const projCard = opCard()
  projCard.appendChild(sectionTitle('My Projects'))
  if (projects.status !== 'fulfilled' || !projects.value || projects.value.length === 0) {
    projCard.appendChild(opEmpty({
      title: 'No projects yet',
      message: 'Create your first project to start tracking work.',
      action: opButton({
        text: '+ New Project',
        variant: 'primary',
        onClick: () => router.navigate('/projects/new'),
      }),
    }))
  } else {
    const ul = document.createElement('ul')
    ul.className = 'op-list'
    for (const p of projects.value) {
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.className = 'op-list__item'
      a.href = `/projects/${p.id}`
      a.innerHTML = `
        <div style="font-weight: var(--op-fw-medium)">${escapeHtml(p.name)}</div>
        <div style="font-size: var(--op-fs-xs); color: var(--op-text-muted)">${escapeHtml(p.identifier || '')}</div>
      `
      li.appendChild(a)
      ul.appendChild(li)
    }
    projCard.appendChild(ul)
  }
  grid.appendChild(projCard)

  // ── Recent activity card ────────────────────────────────────────────
  const actCard = opCard()
  actCard.appendChild(sectionTitle('Recent Activity'))
  if (activity.status !== 'fulfilled' || !activity.value || activity.value.length === 0) {
    actCard.appendChild(opEmpty({
      title: 'No recent activity',
      message: 'Activity from your projects will appear here.',
    }))
  } else {
    const ul = document.createElement('ul')
    ul.className = 'op-list'
    for (const a of activity.value.slice(0, 8)) {
      const li = document.createElement('li')
      li.className = 'op-list__item'
      li.innerHTML = `
        <div style="font-size: var(--op-fs-sm)">${escapeHtml(a.message || a.action || 'Activity')}</div>
        <div style="font-size: var(--op-fs-xs); color: var(--op-text-muted)">${formatTime(a.createdAt || a.timestamp)}</div>
      `
      ul.appendChild(li)
    }
    actCard.appendChild(ul)
  }
  grid.appendChild(actCard)

  // ── Quick links card ────────────────────────────────────────────────
  const linkCard = opCard()
  linkCard.appendChild(sectionTitle('Quick Links'))
  const links = [
    { href: '/projects',           label: 'All projects' },
    { href: '/my-page',            label: 'My page' },
    { href: '/notifications',      label: 'Notifications' },
    { href: '/help',               label: 'Help' },
  ]
  const linkList = document.createElement('ul')
  linkList.className = 'op-list'
  for (const l of links) {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.className = 'op-list__item'
    a.href = l.href
    a.textContent = l.label
    li.appendChild(a)
    linkList.appendChild(li)
  }
  linkCard.appendChild(linkList)
  grid.appendChild(linkCard)
}

function sectionTitle(text) {
  const h = document.createElement('h2')
  h.style.fontSize = 'var(--op-fs-lg)'
  h.style.fontWeight = 'var(--op-fw-semibold)'
  h.style.marginBottom = 'var(--op-sp-3)'
  h.textContent = text
  return h
}

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatTime(ts) {
  if (!ts) return ''
  const d = typeof ts === 'string' ? new Date(ts) : ts
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

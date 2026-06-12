// frontend/pages/projects/index.js — Phase 0 placeholder
import { opEmpty, opButton } from '../../components/primitives/index.js'
import { router } from '../../router.js'

export default function ProjectsIndexPage({ container }) {
  const header = document.createElement('div')
  header.className = 'op-page-header'
  header.appendChild(h1('Projects'))
  header.appendChild(opButton({
    text: '+ New Project',
    variant: 'primary',
    onClick: () => router.navigate('/projects/new'),
  }))
  container.appendChild(header)

  container.appendChild(opEmpty({
    title: 'Projects index — Phase 1',
    message: 'This page will be implemented in Phase 1 (3 weeks). For now, the sidebar shows recent projects you can click into.',
  }))
}

function h1(t) { const h = document.createElement('h1'); h.textContent = t; return h }

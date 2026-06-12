// frontend/pages/projects/[projectId]/index.js — Phase 0 placeholder
import { opEmpty } from '../../../components/primitives/index.js'

export default function ProjectHomePage({ container, params }) {
  const h = document.createElement('h1')
  h.textContent = `Project ${params.projectId}`
  h.style.fontSize = 'var(--op-fs-2xl)'
  h.style.fontWeight = 'var(--op-fw-semibold)'
  h.style.marginBottom = 'var(--op-sp-6)'
  container.appendChild(h)
  container.appendChild(opEmpty({
    title: 'Project home — Phase 2',
    message: 'Project overview (modules, recent activity, members) ships in Phase 2.',
  }))
}

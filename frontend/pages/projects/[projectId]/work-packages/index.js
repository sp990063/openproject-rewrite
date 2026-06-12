// frontend/pages/projects/[projectId]/work-packages/index.js — Phase 0 placeholder
import { opEmpty } from '../../../../components/primitives/index.js'

export default function WorkPackagesPage({ container, params }) {
  const h = document.createElement('h1')
  h.textContent = `Work Packages (project ${params.projectId})`
  h.style.fontSize = 'var(--op-fs-2xl)'
  h.style.fontWeight = 'var(--op-fw-semibold)'
  h.style.marginBottom = 'var(--op-sp-6)'
  container.appendChild(h)
  container.appendChild(opEmpty({
    title: 'Work-packages table — Phase 3',
    message: 'Virtualized table, query state, custom cells, drag-to-reorder — Phase 3 (6-8 weeks).',
  }))
}

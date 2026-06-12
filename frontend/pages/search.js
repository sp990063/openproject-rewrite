// frontend/pages/search.js — Phase 0 placeholder
import { opEmpty } from '../components/primitives/index.js'

export default function SearchPage({ container }) {
  const h = document.createElement('h1')
  h.textContent = 'Search'
  h.style.fontSize = 'var(--op-fs-2xl)'
  h.style.fontWeight = 'var(--op-fw-semibold)'
  h.style.marginBottom = 'var(--op-sp-6)'
  container.appendChild(h)
  container.appendChild(opEmpty({
    title: 'Search — Phase 1',
    message: 'Global search (debounced input + result list) will be implemented in Phase 1.',
  }))
}

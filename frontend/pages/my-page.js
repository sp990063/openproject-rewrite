// frontend/pages/my-page.js — Phase 0 placeholder
import { opEmpty } from '../components/primitives/index.js'

export default function MyPage({ container }) {
  const h = document.createElement('h1')
  h.textContent = 'My Page'
  h.style.fontSize = 'var(--op-fs-2xl)'
  h.style.fontWeight = 'var(--op-fw-semibold)'
  h.style.marginBottom = 'var(--op-sp-6)'
  container.appendChild(h)
  container.appendChild(opEmpty({
    title: 'My page — Phase 1',
    message: 'Widget grid will be implemented in Phase 1.',
  }))
}

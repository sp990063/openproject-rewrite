// frontend/pages/help/index.js — Phase 0 placeholder
import { opEmpty } from '../../components/primitives/index.js'

export default function HelpIndexPage({ container }) {
  const h = document.createElement('h1')
  h.textContent = 'Help'
  h.style.fontSize = 'var(--op-fs-2xl)'
  h.style.fontWeight = 'var(--op-fw-semibold)'
  h.style.marginBottom = 'var(--op-sp-6)'
  container.appendChild(h)
  container.appendChild(opEmpty({
    title: 'Help center — Phase 0 placeholder',
    message: 'For now, use the existing Next.js /help pages via the URL bar.',
  }))
}

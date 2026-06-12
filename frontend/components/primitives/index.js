// frontend/components/primitives/index.js
// ─────────────────────────────────────────────────────────────────────────────
// 12 vanilla component factories. Each returns an HTMLElement. None use
// Shadow DOM (we chose simpler scoped class names over encapsulation, and
// we don't need to ship the entire component CSS into isolated trees).
//
// All factories are pure: they take a config object, return an element,
// attach event listeners, and the caller is responsible for appending the
// returned element to the DOM. Cleanup is the caller's responsibility
// (e.g. via AbortController for listeners).
//
// Conventions:
//   - First arg is a config object with `class`, `text`, `children`, `on*` callbacks
//   - Element factories are named `op<Name>` to match the CSS class `.op-name`
//   - All event handler props take a function; we attach via addEventListener
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. opButton ───────────────────────────────────────────────────────────
/**
 * @param {{text?: string, variant?: 'primary'|'danger'|'ghost', size?: 'sm'|'md'|'lg', disabled?: boolean, onClick?: Function, type?: 'button'|'submit', icon?: string}} [opts]
 */
export function opButton(opts = {}) {
  const el = document.createElement('button')
  el.type = opts.type || 'button'
  el.className = 'op-btn'
  if (opts.variant && opts.variant !== 'default') el.classList.add(`op-btn--${opts.variant}`)
  if (opts.size && opts.size !== 'md') el.classList.add(`op-btn--${opts.size}`)
  if (opts.disabled) el.disabled = true
  if (opts.text) el.textContent = opts.text
  if (opts.icon) {
    const i = document.createElement('span')
    i.textContent = opts.icon
    el.prepend(i)
  }
  if (opts.onClick) el.addEventListener('click', opts.onClick)
  return el
}

// ── 2. opInput ────────────────────────────────────────────────────────────
/**
 * @param {{name?: string, type?: string, value?: string, placeholder?: string, label?: string, help?: string, error?: string, required?: boolean, onInput?: Function, onChange?: Function}} [opts]
 */
export function opInput(opts = {}) {
  const wrap = document.createElement('div')
  wrap.className = 'op-field'
  if (opts.label) {
    const lbl = document.createElement('label')
    lbl.className = 'op-label'
    lbl.textContent = opts.label + (opts.required ? ' *' : '')
    if (opts.name) lbl.htmlFor = `op-in-${opts.name}`
    wrap.appendChild(lbl)
  }
  const el = document.createElement('input')
  el.className = 'op-input'
  el.id = opts.name ? `op-in-${opts.name}` : ''
  el.type = opts.type || 'text'
  if (opts.name) el.name = opts.name
  if (opts.value != null) el.value = opts.value
  if (opts.placeholder) el.placeholder = opts.placeholder
  if (opts.required) el.required = true
  if (opts.error) el.classList.add('op-input--error')
  if (opts.onInput) el.addEventListener('input', (e) => opts.onInput(e.target.value, e))
  if (opts.onChange) el.addEventListener('change', (e) => opts.onChange(e.target.value, e))
  wrap.appendChild(el)
  if (opts.help) {
    const h = document.createElement('div')
    h.className = 'op-help'
    h.textContent = opts.help
    wrap.appendChild(h)
  }
  if (opts.error) {
    const e = document.createElement('div')
    e.className = 'op-error'
    e.textContent = opts.error
    wrap.appendChild(e)
  }
  // Expose input element for direct access
  wrap.inputEl = el
  return wrap
}

// ── 3. opTextarea ─────────────────────────────────────────────────────────
/**
 * @param {{name?: string, value?: string, placeholder?: string, label?: string, rows?: number, onInput?: Function}} [opts]
 */
export function opTextarea(opts = {}) {
  const wrap = document.createElement('div')
  wrap.className = 'op-field'
  if (opts.label) {
    const lbl = document.createElement('label')
    lbl.className = 'op-label'
    lbl.textContent = opts.label
    wrap.appendChild(lbl)
  }
  const el = document.createElement('textarea')
  el.className = 'op-textarea'
  el.rows = opts.rows || 4
  if (opts.name) el.name = opts.name
  if (opts.value) el.value = opts.value
  if (opts.placeholder) el.placeholder = opts.placeholder
  if (opts.onInput) el.addEventListener('input', (e) => opts.onInput(e.target.value, e))
  wrap.appendChild(el)
  wrap.inputEl = el
  return wrap
}

// ── 4. opSelect ───────────────────────────────────────────────────────────
/**
 * @param {{name?: string, value?: string, label?: string, options: Array<{value: string, label: string}>, onChange?: Function}} opts
 */
export function opSelect(opts) {
  const wrap = document.createElement('div')
  wrap.className = 'op-field'
  if (opts.label) {
    const lbl = document.createElement('label')
    lbl.className = 'op-label'
    lbl.textContent = opts.label
    wrap.appendChild(lbl)
  }
  const el = document.createElement('select')
  el.className = 'op-select'
  for (const o of opts.options) {
    const opt = document.createElement('option')
    opt.value = o.value
    opt.textContent = o.label
    if (o.value === opts.value) opt.selected = true
    el.appendChild(opt)
  }
  if (opts.onChange) el.addEventListener('change', (e) => opts.onChange(e.target.value, e))
  wrap.appendChild(el)
  wrap.inputEl = el
  return wrap
}

// ── 5. opCheckbox ─────────────────────────────────────────────────────────
/**
 * @param {{name?: string, checked?: boolean, label?: string, onChange?: Function}} opts
 */
export function opCheckbox(opts) {
  const wrap = document.createElement('label')
  wrap.className = 'op-checkbox'
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  if (opts.name) cb.name = opts.name
  if (opts.checked) cb.checked = true
  if (opts.onChange) cb.addEventListener('change', (e) => opts.onChange(e.target.checked, e))
  wrap.appendChild(cb)
  if (opts.label) {
    const span = document.createElement('span')
    span.textContent = opts.label
    wrap.appendChild(span)
  }
  wrap.inputEl = cb
  return wrap
}

// ── 6. opDialog ───────────────────────────────────────────────────────────
/**
 * A modal dialog. Returns { el, close, onClose }.
 * @param {{title?: string, body: HTMLElement, footer?: HTMLElement, size?: 'md'|'lg'|'xl', onClose?: Function}} opts
 */
export function opDialog(opts) {
  const backdrop = document.createElement('div')
  backdrop.className = 'op-dialog-backdrop'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')
  if (opts.title) backdrop.setAttribute('aria-label', opts.title)

  const dialog = document.createElement('div')
  dialog.className = 'op-dialog'
  if (opts.size && opts.size !== 'md') dialog.classList.add(`op-dialog--${opts.size}`)

  // Header
  if (opts.title) {
    const header = document.createElement('div')
    header.className = 'op-dialog__header'
    const h = document.createElement('h2')
    h.className = 'op-dialog__title'
    h.textContent = opts.title
    header.appendChild(h)
    const close = document.createElement('button')
    close.className = 'op-btn op-btn--ghost op-btn--sm'
    close.setAttribute('aria-label', 'Close')
    close.textContent = '✕'
    close.addEventListener('click', () => close_())
    header.appendChild(close)
    dialog.appendChild(header)
  }

  // Body
  const body = document.createElement('div')
  body.className = 'op-dialog__body'
  if (opts.body instanceof HTMLElement) body.appendChild(opts.body)
  else if (typeof opts.body === 'string') body.innerHTML = opts.body
  dialog.appendChild(body)

  // Footer
  if (opts.footer) {
    const footer = document.createElement('div')
    footer.className = 'op-dialog__footer'
    if (opts.footer instanceof HTMLElement) footer.appendChild(opts.footer)
    dialog.appendChild(footer)
  }

  backdrop.appendChild(dialog)

  function close_() {
    backdrop.remove()
    document.removeEventListener('keydown', onEsc)
    opts.onClose && opts.onClose()
  }
  function onEsc(e) { if (e.key === 'Escape') close_() }
  document.addEventListener('keydown', onEsc)
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close_() })

  return { el: backdrop, close: close_, onClose: (fn) => { opts.onClose = fn } }
}

// ── 7. opDropdown ─────────────────────────────────────────────────────────
/**
 * Toggle-button dropdown. Renders trigger + menu items.
 * Click outside to close.
 * @param {{label: string, items: Array<{label: string, onClick: Function, divider?: boolean}>}} opts
 */
export function opDropdown(opts) {
  const wrap = document.createElement('div')
  wrap.className = 'op-dropdown'

  const trigger = opButton({ text: opts.label, variant: 'ghost' })
  wrap.appendChild(trigger)

  const menu = document.createElement('div')
  menu.className = 'op-dropdown__menu'
  menu.style.display = 'none'

  for (const it of opts.items) {
    if (it.divider) {
      const d = document.createElement('div')
      d.className = 'op-dropdown__divider'
      menu.appendChild(d)
      continue
    }
    const item = document.createElement('button')
    item.className = 'op-dropdown__item'
    item.textContent = it.label
    item.addEventListener('click', () => {
      menu.style.display = 'none'
      it.onClick && it.onClick()
    })
    menu.appendChild(item)
  }
  wrap.appendChild(menu)

  trigger.addEventListener('click', (e) => {
    e.stopPropagation()
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none'
  })
  document.addEventListener('click', () => { menu.style.display = 'none' })

  return wrap
}

// ── 8. opTabs ─────────────────────────────────────────────────────────────
/**
 * @param {{tabs: Array<{id: string, label: string, panel: HTMLElement}>, active?: string, onChange?: Function}} opts
 */
export function opTabs(opts) {
  const root = document.createElement('div')
  root.className = 'op-tabs'

  const list = document.createElement('div')
  list.className = 'op-tabs__list'
  list.setAttribute('role', 'tablist')

  let activeId = opts.active || (opts.tabs[0] && opts.tabs[0].id)
  const panels = new Map()

  function activate(id) {
    activeId = id
    list.querySelectorAll('.op-tabs__tab').forEach((btn) => {
      const isActive = btn.dataset.id === id
      btn.classList.toggle('op-tabs__tab--active', isActive)
      btn.setAttribute('aria-selected', String(isActive))
    })
    for (const [pid, panel] of panels) {
      panel.style.display = pid === id ? '' : 'none'
    }
    opts.onChange && opts.onChange(id)
  }

  for (const t of opts.tabs) {
    const btn = document.createElement('button')
    btn.className = 'op-tabs__tab' + (t.id === activeId ? ' op-tabs__tab--active' : '')
    btn.dataset.id = t.id
    btn.setAttribute('role', 'tab')
    btn.setAttribute('aria-selected', String(t.id === activeId))
    btn.textContent = t.label
    btn.addEventListener('click', () => activate(t.id))
    list.appendChild(btn)

    const panel = document.createElement('div')
    panel.className = 'op-tabs__panel'
    panel.setAttribute('role', 'tabpanel')
    if (t.panel instanceof HTMLElement) panel.appendChild(t.panel)
    else if (typeof t.panel === 'string') panel.innerHTML = t.panel
    if (t.id !== activeId) panel.style.display = 'none'
    panels.set(t.id, panel)
    root.appendChild(panel)
  }

  root.appendChild(list)
  return { el: root, activate }
}

// ── 9. opToast (container + push helper) ─────────────────────────────────
import { toasts as toastsSignal, dismissToast } from '../../store.js'
import { effect } from '../../store.js'

/**
 * Mounts a toast container at the end of <body>. Auto-renders
 * toast queue from the store. Returns the container element.
 * Call once at app bootstrap.
 */
export function opToastHost() {
  const host = document.createElement('div')
  host.className = 'op-toasts'
  host.setAttribute('role', 'status')
  host.setAttribute('aria-live', 'polite')
  document.body.appendChild(host)

  effect(() => {
    const list = toastsSignal.value
    host.innerHTML = ''
    for (const t of list) {
      const el = document.createElement('div')
      el.className = `op-toast op-toast--${t.kind}`
      el.textContent = t.text
      el.addEventListener('click', () => dismissToast(t.id))
      host.appendChild(el)
    }
  })

  return host
}

// ── 10. opSpinner ──────────────────────────────────────────────────────────
/**
 * @param {{size?: 'sm'|'lg', label?: string}} [opts]
 */
export function opSpinner(opts = {}) {
  const wrap = document.createElement('span')
  wrap.className = 'op-spinner' + (opts.size === 'lg' ? ' op-spinner--lg' : '')
  wrap.setAttribute('aria-label', opts.label || 'Loading')
  if (opts.label) {
    const t = document.createTextNode(' ' + opts.label)
    wrap.appendChild(t)
  }
  return wrap
}

// ── Bonus: opBadge (used in test) ─────────────────────────────────────────
/**
 * @param {{text: string, kind?: 'success'|'warning'|'danger'|'info'|'primary'|'default'}} opts
 */
export function opBadge(opts) {
  const el = document.createElement('span')
  el.className = 'op-badge'
  if (opts.kind && opts.kind !== 'default') el.classList.add(`op-badge--${opts.kind}`)
  el.textContent = opts.text
  return el
}

// ── 11. opEmpty ───────────────────────────────────────────────────────────
/**
 * @param {{title?: string, message?: string, action?: HTMLElement}} [opts]
 */
export function opEmpty(opts = {}) {
  const root = document.createElement('div')
  root.className = 'op-empty'
  if (opts.title) {
    const t = document.createElement('div')
    t.className = 'op-empty__title'
    t.textContent = opts.title
    root.appendChild(t)
  }
  if (opts.message) {
    const m = document.createElement('div')
    m.textContent = opts.message
    root.appendChild(m)
  }
  if (opts.action) root.appendChild(opts.action)
  return root
}

// ── 12. opTooltip ─────────────────────────────────────────────────────────
/**
 * Attach a simple tooltip to a child element. Returns the child wrapped.
 * @param {{target: HTMLElement, text: string, placement?: 'top'|'bottom'}} opts
 */
export function opTooltip(opts) {
  let tip = null
  const show = () => {
    if (tip) return
    tip = document.createElement('div')
    tip.className = 'op-tooltip'
    tip.textContent = opts.text
    const rect = opts.target.getBoundingClientRect()
    tip.style.position = 'fixed'
    tip.style.left = (rect.left + rect.width / 2) + 'px'
    tip.style.top = (opts.placement === 'bottom' ? rect.bottom + 6 : rect.top - 30) + 'px'
    tip.style.transform = 'translateX(-50%)'
    document.body.appendChild(tip)
  }
  const hide = () => { if (tip) { tip.remove(); tip = null } }
  opts.target.addEventListener('mouseenter', show)
  opts.target.addEventListener('mouseleave', hide)
  opts.target.addEventListener('focus', show)
  opts.target.addEventListener('blur', hide)
  return opts.target
}

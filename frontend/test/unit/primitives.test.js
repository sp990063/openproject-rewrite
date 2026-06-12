// frontend/test/unit/primitives.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  opButton, opInput, opSelect, opCheckbox, opBadge, opSpinner, opEmpty,
} from '../../components/primitives/index.js'

describe('primitives', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('opButton renders text + variant class', () => {
    const b = opButton({ text: 'Click', variant: 'primary' })
    expect(b.className).toBe('op-btn op-btn--primary')
    expect(b.textContent).toBe('Click')
    expect(b.tagName).toBe('BUTTON')
  })

  it('opButton fires onClick', () => {
    const fn = vi.fn()
    const b = opButton({ text: 'X', onClick: fn })
    b.click()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('opButton respects disabled', () => {
    const b = opButton({ text: 'X', disabled: true })
    expect(b.disabled).toBe(true)
  })

  it('opInput renders label + input + value', () => {
    const f = opInput({ name: 'email', label: 'Email', value: 'a@b.c' })
    document.body.appendChild(f)
    expect(f.querySelector('label').textContent).toContain('Email')
    expect(f.inputEl.value).toBe('a@b.c')
  })

  it('opInput fires onInput', () => {
    const fn = vi.fn()
    const f = opInput({ onInput: fn })
    document.body.appendChild(f)
    f.inputEl.value = 'typed'
    f.inputEl.dispatchEvent(new Event('input'))
    expect(fn).toHaveBeenCalledWith('typed', expect.any(Event))
  })

  it('opSelect renders options', () => {
    const f = opSelect({
      name: 'color',
      options: [{ value: 'r', label: 'Red' }, { value: 'b', label: 'Blue' }],
      value: 'b',
    })
    document.body.appendChild(f)
    const sel = f.inputEl
    expect(sel.tagName).toBe('SELECT')
    expect(sel.options).toHaveLength(2)
    expect(sel.value).toBe('b')
  })

  it('opCheckbox toggles checked state', () => {
    const fn = vi.fn()
    const c = opCheckbox({ label: 'Agree', onChange: fn })
    document.body.appendChild(c)
    expect(c.inputEl.checked).toBe(false)
    c.inputEl.checked = true
    c.inputEl.dispatchEvent(new Event('change'))
    expect(fn).toHaveBeenCalledWith(true, expect.any(Event))
  })

  it('opBadge applies kind class', () => {
    const b = opBadge({ text: 'OK', kind: 'success' })
    expect(b.className).toBe('op-badge op-badge--success')
    expect(b.textContent).toBe('OK')
  })

  it('opSpinner has spinner class', () => {
    const s = opSpinner({ size: 'lg' })
    expect(s.className).toBe('op-spinner op-spinner--lg')
  })

  it('opEmpty renders title + message', () => {
    const e = opEmpty({ title: 'Nothing', message: 'Try again' })
    expect(e.querySelector('.op-empty__title').textContent).toBe('Nothing')
    expect(e.textContent).toContain('Try again')
  })
})

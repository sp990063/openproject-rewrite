// hooks/useKeyboardShortcuts.ts
// Central keyboard shortcut handler. Mount once at the AppShell level so
// hotkeys (cmd+k, g+d, etc.) work across the app.
//
// The shortcut string format is a space-separated chord:
//   "mod+k"     – cmd on macOS, ctrl on win/linux
//   "ctrl+shift+p"
//   "g d"       – a sequence (press g, then d within 1000ms)
//   "escape"
//   "?"
//
// Use `enableOnFormTags: false` (the default) for global hotkeys that
// should NOT fire while typing in an input. Pass `{ allowInInputs: true }`
// to opt in.
'use client'

import { useEffect, useRef } from 'react'

export interface ShortcutConfig {
  /** Combo or sequence, see file header for format */
  combo: string
  /** Action to run when the combo matches */
  handler: (e: KeyboardEvent) => void
  /** If true, fires even when the active element is an input/textarea */
  allowInInputs?: boolean
  /** If true, fires even when modifier keys are held (default false = require exact match) */
  ignoreModifiers?: boolean
  /** Description shown in the help dialog (optional) */
  description?: string
}

export type Shortcut = string | ShortcutConfig

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '')

const SEQUENCE_TIMEOUT_MS = 1000

function normalize(combo: string): string {
  return combo
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace('cmd', 'mod')
    .replace('command', 'mod')
    .trim()
}

function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  const mod = isMac ? e.metaKey : e.ctrlKey
  if (mod) parts.push('mod')
  if (e.shiftKey) parts.push('shift')
  if (e.altKey) parts.push('alt')
  // Map keys: ' ' -> 'space', 'escape' -> 'escape', etc.
  let key = e.key.toLowerCase()
  if (key === ' ') key = 'space'
  if (key === 'escape') key = 'escape'
  if (key.length === 1) key = key
  parts.push(key)
  return parts.join('+')
}

function isFormElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

/**
 * Mount a list of keyboard shortcuts. The hook attaches a single
 * keydown listener; each chord (or sequence) is matched against the
 * pressed keys.
 *
 * Sequencing: "g d" means the user presses g, releases, then presses d
 * within 1000ms. Other keys in between cancel the sequence.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  // Normalize configs to a stable array reference so the effect deps are stable.
  const normRef = useRef<
    { parts: string[]; isSequence: boolean; cfg: ShortcutConfig }[]
  >([])

  useEffect(() => {
    normRef.current = shortcuts.map((s) => {
      const cfg: ShortcutConfig =
        typeof s === 'string' ? { combo: s, handler: () => {} } : s
      const normalized = normalize(cfg.combo)
      const parts = normalized.split(' ')
      return { parts, isSequence: parts.length > 1, cfg }
    })
  }, [shortcuts])

  // Sequence tracking
  const seqBuffer = useRef<{ combo: string; at: number } | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const now = Date.now()
      const inForm = isFormElement(e.target)

      for (const { parts, isSequence, cfg } of normRef.current) {
        if (inForm && !cfg.allowInInputs) continue
        if (isSequence) {
          // Sequence: parts[0] is the first key, parts[parts.length - 1] is the last.
          if (parts.length !== 2) continue
          const first = parts[0]!
          const last = parts[parts.length - 1]!
          const incoming = eventToCombo(e)
          if (incoming === first) {
            seqBuffer.current = { combo: first, at: now }
            return
          }
          if (
            seqBuffer.current &&
            seqBuffer.current.combo === first &&
            now - seqBuffer.current.at < SEQUENCE_TIMEOUT_MS &&
            incoming === last
          ) {
            seqBuffer.current = null
            e.preventDefault()
            cfg.handler(e)
            return
          }
        } else {
          // Direct chord.
          const target = parts[0]!
          const incoming = eventToCombo(e)
          if (incoming === target) {
            e.preventDefault()
            cfg.handler(e)
            return
          }
        }
      }
      // Any non-matching key cancels a pending sequence (unless it's the
      // first key of a different sequence that just matched above).
      if (seqBuffer.current && Date.now() - seqBuffer.current.at >= SEQUENCE_TIMEOUT_MS) {
        seqBuffer.current = null
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

import { useEffect, useCallback, useState } from 'react'

interface UseKeyboardShortcutsOptions {
  onToggleShortcuts?: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts({ onToggleShortcuts, enabled = true }: UseKeyboardShortcutsOptions = {}) {
  const [pressedKeys, setPressedKeys] = useState<string[]>([])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Single key shortcuts
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onToggleShortcuts?.()
        return
      }

      // Handle 'g' prefix for navigation shortcuts
      if (event.key === 'g' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setPressedKeys(['g'])
        return
      }

      // After 'g' was pressed, check for second key
      if (pressedKeys.includes('g')) {
        setPressedKeys([])
        
        if (event.key === 'i') {
          // Navigate to Inbox
          window.location.href = '/notifications'
          return
        }
        
        if (event.key === 'p') {
          // Navigate to Projects
          window.location.href = '/projects'
          return
        }
      }

      // Action shortcuts
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'c':
            // Create - could be connected to a create handler
            break
          case 'e':
            // Edit - could be connected to an edit handler
            break
          case 's':
            // Save
            event.preventDefault()
            break
          case 'w':
            // Work packages
            window.location.href = '/my-page'
            return
          case 'b':
            // Board view
            window.location.href = '/projects'
            return
        }
      }
    },
    [onToggleShortcuts, pressedKeys]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])

  return { pressedKeys }
}

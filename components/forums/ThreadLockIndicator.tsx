import React from 'react'

interface ThreadLockIndicatorProps {
  isLocked?: boolean
  showText?: boolean
}

export function ThreadLockIndicator({ isLocked, showText = false }: ThreadLockIndicatorProps) {
  if (!isLocked) return null

  if (showText) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
        title="Locked"
      >
        🔒 Locked
      </span>
    )
  }

  return (
    <span title="Locked">🔒</span>
  )
}

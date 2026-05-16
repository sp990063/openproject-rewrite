import React from 'react'

interface ThreadPinBadgeProps {
  isPinned?: boolean
}

export function ThreadPinBadge({ isPinned }: ThreadPinBadgeProps) {
  if (!isPinned) return null

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
      title="Pinned"
    >
      📌 Pinned
    </span>
  )
}

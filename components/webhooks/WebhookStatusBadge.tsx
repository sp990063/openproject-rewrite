/**
 * WebhookStatusBadge - shows if a webhook is active or inactive
 */
import React from 'react'

interface WebhookStatusBadgeProps {
  active: boolean
}

export function WebhookStatusBadge({ active }: WebhookStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        active
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-gray-100 text-gray-800 border border-gray-200'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

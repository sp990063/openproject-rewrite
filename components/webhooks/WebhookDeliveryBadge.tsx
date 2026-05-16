/**
 * WebhookDeliveryBadge - displays status of a webhook delivery
 */
import React from 'react'

interface WebhookDeliveryBadgeProps {
  status: 'pending' | 'success' | 'failed'
  attempts?: number
}

export function WebhookDeliveryBadge({ status, attempts }: WebhookDeliveryBadgeProps) {
  const statusConfig = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    success: {
      label: 'Success',
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-800 border-red-200',
    },
  }

  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
      {status === 'failed' && attempts !== undefined && (
        <span className="ml-1 text-xs opacity-75">({attempts} attempts)</span>
      )}
    </span>
  )
}

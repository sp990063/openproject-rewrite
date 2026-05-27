import React, { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Status } from '@/types'
import type { ProjectWipLimit } from '@/types'

interface WipLimitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  statuses: Status[]
  existingLimits: ProjectWipLimit[]
  projectId: string
  onUpdate: (statusId: string, limit: number | null) => Promise<void>
}

export function WipLimitDialog({
  open,
  onOpenChange,
  statuses,
  existingLimits,
  onUpdate,
}: WipLimitDialogProps) {
  const [selectedStatusId, setSelectedStatusId] = useState('')
  const [limitValue, setLimitValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Build a map of existing limits
  const limitMap = new Map<string, number | null>()
  for (const l of existingLimits) limitMap.set(l.statusId, l.limit)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedStatusId) {
      setError('Please select a status.')
      return
    }

    const limit = limitValue.trim() === '' ? null : parseInt(limitValue, 10)
    if (limit !== null && isNaN(limit)) {
      setError('Limit must be a number.')
      return
    }

    setIsSubmitting(true)
    try {
      await onUpdate(selectedStatusId, limit)
      // Reset form after success
      setSelectedStatusId('')
      setLimitValue('')
      onOpenChange(false)
    } catch (err) {
      setError('Failed to update WIP limit. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset on close
      setSelectedStatusId('')
      setLimitValue('')
      setError('')
    }
    onOpenChange(newOpen)
  }

  // Sort statuses by position
  const sortedStatuses = [...statuses].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  // Find the status name for current selection
  const selectedStatus = statuses.find(s => s.id === selectedStatusId)
  const currentLimit = selectedStatusId ? limitMap.get(selectedStatusId) ?? null : null

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Configure WIP Limits"
      description="Set work-in-progress limits per status column on the board."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current limits summary */}
        {existingLimits.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Current limits</p>
            {sortedStatuses
              .filter(s => limitMap.has(s.id))
              .map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color ?? '#6B7280' }}
                    />
                    <span className="text-gray-700">{s.name}</span>
                  </span>
                  <span className="text-gray-500 font-mono">
                    {limitMap.get(s.id) === null ? '∞' : limitMap.get(s.id)}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Status selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={selectedStatusId}
            onChange={e => {
              setSelectedStatusId(e.target.value)
              setError('')
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a status...</option>
            {sortedStatuses.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {limitMap.has(s.id) ? `(current: ${limitMap.get(s.id) === null ? '∞' : limitMap.get(s.id)})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Limit input */}
        {selectedStatusId && (
          <Input
            label={selectedStatus ? `WIP Limit for "${selectedStatus.name}"` : 'WIP Limit'}
            type="number"
            min={1}
            placeholder="Leave empty for no limit (unlimited)"
            value={limitValue}
            onChange={e => {
              setLimitValue(e.target.value)
              setError('')
            }}
            helperText={currentLimit !== undefined ? `Current limit: ${currentLimit === null ? 'unlimited' : currentLimit}` : undefined}
          />
        )}

        {/* Clear limit checkbox */}
        {selectedStatusId && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={limitValue === ''}
              onChange={e => {
                if (e.target.checked) setLimitValue('')
              }}
            />
            Remove limit (set to unlimited)
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={!selectedStatusId}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
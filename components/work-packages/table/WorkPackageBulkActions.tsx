import React, { useState } from 'react'
import { Button, Modal } from '@/components/ui'

interface WorkPackageBulkActionsProps {
  selectedIds: Set<string>
  onClearSelection: () => void
  /** Callback after successful bulk delete */
  onBulkDelete: (ids: string[]) => Promise<void>
  /** Callback after successful bulk status change */
  onBulkStatusChange: (ids: string[], statusId: string) => Promise<void>
  statuses: { id: string; name: string; color: string }[]
}

export function WorkPackageBulkActions({
  selectedIds,
  onClearSelection,
  onBulkDelete,
  onBulkStatusChange,
  statuses,
}: WorkPackageBulkActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)

  const count = selectedIds.size
  if (count === 0) return null

  const ids = Array.from(selectedIds)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onBulkDelete(ids)
      setShowDeleteConfirm(false)
      onClearSelection()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStatusChange = async () => {
    if (!selectedStatus) return
    setIsChangingStatus(true)
    try {
      await onBulkStatusChange(ids, selectedStatus)
      setShowStatusModal(false)
      setSelectedStatus('')
      onClearSelection()
    } finally {
      setIsChangingStatus(false)
    }
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl">
        <span className="text-sm font-medium">{count} selected</span>

        <div className="w-px h-5 bg-gray-600" />

        <Button
          variant="secondary"
          size="sm"
          className="text-white border-white/30 hover:bg-white/10"
          onClick={() => setShowStatusModal(true)}
        >
          Change Status
        </Button>

        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete
        </Button>

        <button
          onClick={onClearSelection}
          className="ml-1 text-sm text-gray-400 hover:text-white cursor-pointer"
          aria-label="Clear selection"
        >
          ×
        </button>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${count} work package${count > 1 ? 's' : ''}?`}
        description="This action cannot be undone."
      >
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
            Delete {count} item{count > 1 ? 's' : ''}
          </Button>
        </div>
      </Modal>

      {/* Change status modal */}
      <Modal
        open={showStatusModal}
        onOpenChange={setShowStatusModal}
        title={`Change status for ${count} work package${count > 1 ? 's' : ''}`}
        description="Select the new status."
      >
        <div className="space-y-2 mt-4">
          {statuses.map((s) => (
            <label
              key={s.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                selectedStatus === s.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="bulk-status"
                value={s.id}
                checked={selectedStatus === s.id}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-sm font-medium text-gray-700">{s.name}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleStatusChange}
            isLoading={isChangingStatus}
            disabled={!selectedStatus}
          >
            Apply
          </Button>
        </div>
      </Modal>
    </>
  )
}

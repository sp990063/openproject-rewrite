import React, { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { useCreateRelation } from '@/hooks/use-work-packages'

interface AddRelationButtonProps {
  workPackageId: string
  onRelationAdded?: () => void
}

export function AddRelationButton({ workPackageId, onRelationAdded }: AddRelationButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [targetWpId, setTargetWpId] = useState('')
  const [relationType, setRelationType] = useState<string>('relates_to')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createRelation = useCreateRelation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetWpId.trim()) return

    setIsSubmitting(true)
    try {
      await createRelation.mutateAsync({
        fromId: workPackageId,
        toId: targetWpId,
        relationType: relationType as 'blocks' | 'blocked_by' | 'precedes' | 'follows' | 'relates',
      })
      setIsOpen(false)
      setTargetWpId('')
      setRelationType('relates_to')
      onRelationAdded?.()
    } catch {
      // Error handling done by the mutation
    } finally {
      setIsSubmitting(false)
    }
  }

  const RELATION_TYPES = [
    { value: 'blocks', label: 'Blocks' },
    { value: 'blocked_by', label: 'Blocked by' },
    { value: 'relates_to', label: 'Relates to' },
    { value: 'precedes', label: 'Precedes' },
    { value: 'follows', label: 'Follows' },
    { value: 'duplicates', label: 'Duplicates' },
    { value: 'duplicated_by', label: 'Duplicated by' },
  ]

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-gray-500 hover:text-gray-700"
      >
        + Add Relation
      </Button>

      <Modal open={isOpen} onOpenChange={setIsOpen} title="Add Relation">
        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Relation Type
            </label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {RELATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Work Package ID
            </label>
            <input
              type="text"
              value={targetWpId}
              onChange={(e) => setTargetWpId(e.target.value)}
              placeholder="Enter work package ID or search..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Add
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

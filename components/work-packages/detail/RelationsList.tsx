import React, { useState } from 'react'
import { useWorkPackageRelations } from '@/hooks/use-work-packages'
import { Button, Modal } from '@/components/ui'
import type { Relation } from '@/types'

interface RelationsListProps {
  workPackageId: string
}

export function RelationsList({ workPackageId }: RelationsListProps) {
  const { data: relations, isLoading, isError } = useWorkPackageRelations(workPackageId)
  const [showAddModal, setShowAddModal] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError || !relations || relations.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-gray-400">No relations yet.</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          + Add Relation
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Relation list */}
      {relations?.map((relation: Relation) => (
        <RelationItem key={relation.id} relation={relation} />
      ))}

      {/* Add button */}
      <div className="pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="text-gray-500 hover:text-gray-700"
        >
          + Add Relation
        </Button>
      </div>

      {/* Add relation modal */}
      {showAddModal && (
        <AddRelationModal
          workPackageId={workPackageId}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}

// ─── RelationItem ───────────────────────────────────────────────────────────────

function RelationItem({ relation }: { relation: Relation }) {
  const RELATION_LABELS: Record<string, string> = {
    blocks: 'Blocks',
    blocked_by: 'Blocked by',
    relates_to: 'Relates to',
    duplicates: 'Duplicates',
    duplicated_by: 'Duplicated by',
    follows: 'Follows',
    precedes: 'Precedes',
    includes: 'Includes',
    part_of: 'Part of',
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-gray-500 w-20 flex-shrink-0">
          {RELATION_LABELS[relation.type] ?? relation.type}
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          {relation.targetWorkPackage?.type && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white flex-shrink-0"
              style={{ backgroundColor: relation.targetWorkPackage.type.color ?? '#6366F1' }}
            >
              {relation.targetWorkPackage.type.name}
            </span>
          )}
          <a
            href={`#`}
            className="text-sm text-blue-600 hover:text-blue-800 truncate"
            onClick={(e) => e.preventDefault()}
          >
            {relation.targetWorkPackage?.subject ?? relation.targetWorkPackageId}
          </a>
        </div>
      </div>

      <button
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
        aria-label={`Remove relation: ${relation.type}`}
        onClick={() => {
          // TODO: Delete relation via hook
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ─── AddRelationModal ─────────────────────────────────────────────────────────

interface AddRelationModalProps {
  workPackageId: string
  onClose: () => void
}

function AddRelationModal({ workPackageId, onClose }: AddRelationModalProps) {
  const [targetWpId, setTargetWpId] = useState('')
  const [relationType, setRelationType] = useState('relates_to')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // TODO: wire up useCreateRelation hook
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetWpId.trim()) return

    setIsSubmitting(true)
    try {
      // await createRelation.mutateAsync({ fromWorkPackageId: workPackageId, toWorkPackageId: targetWpId, type: relationType })
      onClose()
    } catch {
      // TODO: show error
    } finally {
      setIsSubmitting(false)
    }
  }

  const RELATION_TYPES = [
    { value: 'blocks', label: 'Blocks' },
    { value: 'blocked_by', label: 'Blocked by' },
    { value: 'relates_to', label: 'Relates to' },
    { value: 'duplicates', label: 'Duplicates' },
    { value: 'duplicated_by', label: 'Duplicated by' },
    { value: 'follows', label: 'Follows' },
    { value: 'precedes', label: 'Precedes' },
  ]

  return (
    <Modal open onOpenChange={onClose} title="Add Relation">
      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Relation Type</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Work Package ID</label>
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
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>Add</Button>
        </div>
      </form>
    </Modal>
  )
}

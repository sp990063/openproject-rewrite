import React, { useState, useRef, useEffect } from 'react'
import { useCreateWorkPackage } from '@/hooks/use-work-packages'

interface WorkPackageBoardAddCardProps {
  statusId: string
  projectId: string
  onClose: () => void
  onCreated?: (wpId: string) => void
}

export function WorkPackageBoardAddCard({ statusId, projectId, onClose, onCreated }: WorkPackageBoardAddCardProps) {
  const [subject, setSubject] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const createWorkPackage = useCreateWorkPackage()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim()) return

    setIsSubmitting(true)
    try {
      const wp = await createWorkPackage.mutateAsync({
        projectId,
        statusId,
        typeId: 'cl00000000000000000000000000', // TODO: resolve default type from project
        priorityId: 'cl00000000000000000000000001', // TODO: resolve default priority
        subject: subject.trim(),
      })
      onCreated?.(wp.id)
      onClose()
    } catch {
      // TODO: show error toast
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit(e)
    }
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} className="bg-white rounded-lg border border-blue-300 p-3 shadow-md">
      <input
        ref={inputRef}
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Work package subject..."
        className="w-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none mb-2"
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!subject.trim() || isSubmitting}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  )
}

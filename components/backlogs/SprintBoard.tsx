// components/backlogs/SprintBoard.tsx
import { useState } from 'react'
import { useSprintBoard, useMoveWorkPackage } from '@/lib/hooks/useBacklogs'

interface SprintBoardProps {
  sprintId: string
}

export function SprintBoard({ sprintId }: SprintBoardProps) {
  const { data, isLoading } = useSprintBoard(sprintId)
  const moveMutation = useMoveWorkPackage()
  const [draggedWpId, setDraggedWpId] = useState<string | null>(null)

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-100 rounded" />

  const workPackages = data?.workPackages ?? []
  const columns = [
    { id: 'NEW', label: 'New' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'RESOLVED', label: 'Resolved' },
    { id: 'CLOSED', label: 'Closed' },
  ]

  const handleDrop = async (targetStatusId: string) => {
    if (!draggedWpId) return
    await moveMutation.mutateAsync({ sprintId, workPackageId: draggedWpId, statusId: targetStatusId, position: 0 })
    setDraggedWpId(null)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(col => (
        <div key={col.id} className="flex-shrink-0 w-72">
          <div className="font-semibold text-sm mb-2 text-gray-600 uppercase">{col.label}</div>
          <div
            className="min-h-[200px] border-2 border-dashed border-gray-200 rounded-lg p-2 space-y-2 bg-gray-50/50"
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col.id)}
          >
            {workPackages.filter(wp => wp.statusId === col.id).map(wp => (
              <div
                key={wp.id}
                draggable
                onDragStart={() => setDraggedWpId(wp.id)}
                onDragEnd={() => setDraggedWpId(null)}
                className={`p-3 bg-white border border-gray-200 rounded shadow-sm cursor-grab active:cursor-grabbing transition-opacity
                  ${draggedWpId === wp.id ? 'opacity-40' : 'opacity-100'}`}
              >
                <div className="text-sm font-medium">{wp.subject}</div>
                {wp.storyPoints != null && (
                  <div className="text-xs text-gray-400 mt-1">{wp.storyPoints} pts</div>
                )}
                {wp.assignee && (
                  <div className="text-xs text-gray-400 mt-1">{wp.assignee.name}</div>
                )}
              </div>
            ))}
            {workPackages.filter(wp => wp.statusId === col.id).length === 0 && (
              <div className="text-center py-8 text-xs text-gray-400">No items</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

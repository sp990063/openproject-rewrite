import React from 'react'
import { DragOverlay } from '@dnd-kit/core'
import { WorkPackageBoardCard } from './WorkPackageBoardCard'
import type { WorkPackage } from '@/types'

interface WorkPackageBoardDragLayerProps {
  activeId: string | null
  workPackages: WorkPackage[]
}

export function WorkPackageBoardDragLayer({ activeId, workPackages }: WorkPackageBoardDragLayerProps) {
  const activeWp = workPackages.find((wp) => wp.id === activeId)

  return (
    <DragOverlay>
      {activeWp && (
        <div className="w-72">
          <WorkPackageBoardCard workPackage={activeWp} isDragging />
        </div>
      )}
    </DragOverlay>
  )
}

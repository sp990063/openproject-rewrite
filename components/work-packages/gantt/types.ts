import type { WorkPackage } from '@/types'
export type { GanttZoomLevel } from '@/lib/gantt/calculate'

// Re-export layout types from calculate
export type {
  GanttWorkPackage,
  GanttDependency,
  DependencyType,
  GanttLayoutOptions,
  DragResizeResult,
} from '@/lib/gantt/calculate'

// Re-export calculate functions
export {
  parseDate,
  getDayWidth,
  calculateTimelineBounds,
  calculateGanttLayout,
  calculateRowIndices,
  calculatePath,
  calculateArrowHead,
  computeResizeDates,
  ZOOM_LEVELS,
  zoomIn,
  zoomOut,
} from '@/lib/gantt/calculate'

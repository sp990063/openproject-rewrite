// Gantt Chart View — barrel export
export { GanttChart } from './GanttChart'
export { GanttTimeline } from './GanttTimeline'
export { GanttRows } from './GanttRows'
export { GanttBar } from './GanttBar'
export { GanttDependencyLines } from './GanttDependencyLines'
export { GanttTodayLine } from './GanttTodayLine'
export { GanttZoomControls } from './GanttZoomControls'
export { WorkPackageGanttEmptyState } from './WorkPackageGanttEmptyState'
export { WorkPackageGanttSkeleton } from './WorkPackageGanttSkeleton'

// Types + calculation helpers
export type { GanttWorkPackage, GanttDependency, DependencyType, GanttLayoutOptions, DragResizeResult } from './types'
export type { GanttZoomLevel } from '@/lib/gantt/calculate'
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

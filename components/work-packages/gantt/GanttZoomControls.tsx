import React from 'react'
import { Button } from '@/components/ui'
import { GanttZoomLevel, zoomIn, zoomOut } from './types'

interface GanttZoomControlsProps {
  zoomLevel: GanttZoomLevel
  onZoomIn: () => void
  onZoomOut: () => void
}

const ZOOM_LABELS: Record<GanttZoomLevel, string> = {
  quarter: 'Quarter',
  month:   'Month',
  week:    'Week',
  day:     'Day',
}

export function GanttZoomControls({ zoomLevel, onZoomIn, onZoomOut }: GanttZoomControlsProps) {
  return (
    <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1 bg-white">
      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomOut}
        disabled={zoomLevel === 'quarter'}
        aria-label="Zoom out"
        className="px-2"
      >
        <ZoomOutIcon />
      </Button>

      <span className="px-3 text-sm font-medium text-gray-700 min-w-[80px] text-center">
        {ZOOM_LABELS[zoomLevel]}
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomIn}
        disabled={zoomLevel === 'day'}
        aria-label="Zoom in"
        className="px-2"
      >
        <ZoomInIcon />
      </Button>
    </div>
  )
}

function ZoomInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="4.5" x2="7" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4.5" y1="7" x2="9.5" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ZoomOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4.5" y1="7" x2="9.5" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

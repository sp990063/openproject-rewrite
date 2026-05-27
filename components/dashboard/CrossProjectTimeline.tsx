/**
 * CrossProjectTimeline.tsx
 *
 * Gantt-style cross-project timeline using recharts BarChart.
 * Projects on Y-axis, work packages as bars on a date-based X-axis.
 */

import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { format, differenceInDays, addDays, startOfDay } from 'date-fns'
import type { Project, WorkPackage } from '@/types'

interface CrossProjectTimelineProps {
  projects: Project[]
  workPackages: WorkPackage[]
  isLoading?: boolean
}

// Status color mapping for work package bars
const STATUS_COLORS: Record<string, string> = {
  // Will be populated from workPackage status colors
}

interface GanttBarData {
  projectId: string
  projectName: string
  workPackageId: string
  subject: string
  startDay: number   // day offset from timeline start
  durationDays: number
  color: string
  startDate: Date
  dueDate: Date
}

interface ChartDataRow {
  projectName: string
  projectId: string
  bars: GanttBarData[]
  // For recharts, we store bars as separate data series
  [key: string]: unknown
}

function buildChartData(
  projects: Project[],
  workPackages: WorkPackage[],
  timelineStart: Date,
  timelineEnd: Date
): ChartDataRow[] {
  const daysOffset = (date: Date) => differenceInDays(startOfDay(date), timelineStart)

  // Group work packages by project
  const wpByProject = new Map<string, WorkPackage[]>()
  for (const wp of workPackages) {
    const list = wpByProject.get(wp.projectId) ?? []
    list.push(wp)
    wpByProject.set(wp.projectId, list)
  }

  const rows: ChartDataRow[] = []

  for (const project of projects) {
    const projectWps = wpByProject.get(project.id) ?? []
    const bars: GanttBarData[] = projectWps
      .filter(wp => wp.startDate || wp.dueDate)
      .map(wp => {
        const start = wp.startDate ? startOfDay(new Date(wp.startDate)) : null
        const end = wp.dueDate ? startOfDay(new Date(wp.dueDate)) : null

        // Default to today if no dates
        const barStart = start ?? timelineStart
        const barEnd = end ?? addDays(timelineStart, 7)

        const startDay = Math.max(0, daysOffset(barStart))
        const endDay = Math.min(differenceInDays(timelineEnd, timelineStart), daysOffset(barEnd))
        const durationDays = Math.max(1, endDay - startDay)

        return {
          projectId: project.id,
          projectName: project.name,
          workPackageId: wp.id,
          subject: wp.subject,
          startDay,
          durationDays,
          color: wp.status?.color ?? '#6B7280',
          startDate: barStart,
          dueDate: barEnd,
        } satisfies GanttBarData
      })

    rows.push({
      projectName: project.name,
      projectId: project.id,
      bars,
    })
  }

  return rows
}

// Custom tick formatter for X axis dates
function formatDateTick(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return format(d, 'MMM d')
  } catch {
    return dateStr
  }
}

export function CrossProjectTimeline({ projects, workPackages, isLoading }: CrossProjectTimelineProps) {
  // Compute global timeline range
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const allDates = workPackages
      .flatMap(wp => [wp.startDate, wp.dueDate])
      .filter((d): d is Date => d != null)
      .map(d => startOfDay(new Date(d)))

    if (allDates.length === 0) {
      const now = new Date()
      return {
        timelineStart: startOfDay(addDays(now, -30)),
        timelineEnd: startOfDay(addDays(now, 60)),
        totalDays: 90,
      }
    }

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))

    const start = startOfDay(addDays(minDate, -7))
    const end = startOfDay(addDays(maxDate, 30))
    const total = Math.max(1, differenceInDays(end, start))

    return { timelineStart: start, timelineEnd: end, totalDays: total }
  }, [workPackages])

  // Build chart data
  const chartData = useMemo(
    () => buildChartData(projects, workPackages, timelineStart, timelineEnd),
    [projects, workPackages, timelineStart, timelineEnd]
  )

  // Generate X axis ticks (every ~14 days or so)
  const xAxisTicks = useMemo(() => {
    const ticks: string[] = []
    let current = timelineStart
    while (current <= timelineEnd) {
      ticks.push(format(current, 'yyyy-MM-dd'))
      current = addDays(current, Math.max(1, Math.floor(totalDays / 12)))
    }
    return ticks
  }, [timelineStart, timelineEnd, totalDays])

  // Flatten bars for rendering as named bar series
  // Each work package becomes a named bar series to enable legend
  const barSeries = useMemo(() => {
    const series: { id: string; subject: string; color: string }[] = []
    for (const row of chartData) {
      for (const bar of row.bars) {
        series.push({ id: bar.workPackageId, subject: bar.subject, color: bar.color })
      }
    }
    return series
  }, [chartData])

  // Transform to recharts format: one data object per project row
  // with stacked bars for each work package
  const rechartsData = useMemo(() => {
    return chartData.map(row => {
      const entry: Record<string, unknown> = {
        projectName: row.projectName,
        projectId: row.projectId,
      }
      for (const bar of row.bars) {
        entry[bar.workPackageId] = bar.durationDays
      }
      return entry
    })
  }, [chartData])

  // Reference lines for today
  const todayOffset = useMemo(() => {
    return differenceInDays(startOfDay(new Date()), timelineStart)
  }, [timelineStart])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cross-Project Timeline</h2>
        <div className="text-center py-12 text-gray-500">Loading timeline data...</div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cross-Project Timeline</h2>
        <div className="text-center py-12 text-gray-500">No projects found.</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Cross-Project Timeline</h2>

      <div className="mb-4 flex items-center gap-4 text-sm text-gray-500">
        <span>{projects.length} projects</span>
        <span>•</span>
        <span>{workPackages.length} work packages</span>
        <span>•</span>
        <span>
          {format(timelineStart, 'MMM d, yyyy')} – {format(timelineEnd, 'MMM d, yyyy')}
        </span>
      </div>

      {workPackages.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No work packages with dates.</div>
      ) : (
        <div style={{ width: '100%', height: Math.max(300, projects.length * 60 + 80) }}>
          <ResponsiveContainer>
            <BarChart
              data={rechartsData}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
              <XAxis
                type="number"
                domain={[0, totalDays]}
                ticks={xAxisTicks.map(t => differenceInDays(new Date(t), timelineStart))}
                tickFormatter={(val) => {
                  const d = addDays(timelineStart, val)
                  return format(d, 'MMM d')
                }}
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                type="category"
                dataKey="projectName"
                width={140}
                tick={{ fontSize: 12, fill: '#374151' }}
                axisLine={{ stroke: '#E5E7EB' }}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const data = payload[0]?.payload
                  if (!data) return null

                  // Find the bar data for this tooltip
                  const projectRow = chartData.find(r => r.projectId === data.projectId)
                  const barId = payload[0]?.dataKey as string
                  const bar = projectRow?.bars.find(b => b.workPackageId === barId)

                  if (!bar) return null

                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                      <p className="font-medium text-gray-900 mb-1">{bar.subject}</p>
                      <p className="text-gray-500">Project: {bar.projectName}</p>
                      <p className="text-gray-500">
                        {format(bar.startDate, 'MMM d, yyyy')} → {format(bar.dueDate, 'MMM d, yyyy')}
                      </p>
                      <p className="text-gray-500 mt-1">{bar.durationDays} day{bar.durationDays !== 1 ? 's' : ''}</p>
                    </div>
                  )
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => {
                  const bar = barSeries.find(s => s.id === value)
                  return bar ? (
                    <span title={bar.subject} style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bar.subject}
                    </span>
                  ) : value
                }}
              />

              {/* Render one Bar per work package */}
              {barSeries.map(series => (
                <Bar
                  key={series.id}
                  dataKey={series.id}
                  name={series.id}
                  stackId="timeline"
                  fill={series.color}
                  radius={[2, 2, 2, 2]}
                  background={{ fill: '#F9FAFB' }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Status legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        {Object.entries(
          workPackages.reduce((acc, wp) => {
            if (wp.status) acc[wp.status.name] = wp.status.color
            return acc
          }, {} as Record<string, string>)
        ).map(([statusName, color]) => (
          <div key={statusName} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-gray-600">{statusName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
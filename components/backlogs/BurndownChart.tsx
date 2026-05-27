// components/backlogs/BurndownChart.tsx
import { useBurndown } from '@/lib/hooks/useBacklogs'
import type { BurndownPoint } from '@/lib/hooks/useBacklogs'

interface BurndownChartProps {
  sprintId: string | null
}

export function BurndownChart({ sprintId }: BurndownChartProps) {
  const { data } = useBurndown(sprintId)
  const points: BurndownPoint[] = data?.burndown ?? []

  if (points.length < 2) {
    return <div className="text-center py-8 text-gray-400">Record daily progress to see the burndown chart</div>
  }

  const maxVal = Math.max(...points.map((p: BurndownPoint) => Math.max(p.remaining, p.ideal)))

  return (
    <div className="w-full h-48">
      <svg viewBox="0 0 400 200" className="w-full h-full">
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map(i => (
          <line key={i} x1="40" y1={10 + i * 42} x2="390" y2={10 + i * 42} stroke="#f0f0f0" strokeWidth="1" />
        ))}
        {/* Axes */}
        <line x1="40" y1="10" x2="40" y2="178" stroke="#ccc" strokeWidth="1.5" />
        <line x1="40" y1="178" x2="390" y2="178" stroke="#ccc" strokeWidth="1.5" />
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
          <text key={i} x="38" y={12 + i * 42} fontSize="9" textAnchor="end" fill="#999">
            {Math.round(maxVal * (1 - frac))}
          </text>
        ))}
        {/* Ideal line */}
        <polyline
          fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,3"
          points={points.map((p: BurndownPoint, i: number) => {
            const x = 40 + (i / Math.max(points.length - 1, 1)) * 350
            const y = 178 - (p.ideal / maxVal) * 168
            return `${x},${y}`
          }).join(' ')}
        />
        {/* Actual line */}
        <polyline
          fill="none" stroke="#3b82f6" strokeWidth="2.5"
          points={points.map((p: BurndownPoint, i: number) => {
            const x = 40 + (i / Math.max(points.length - 1, 1)) * 350
            const y = 178 - (p.remaining / maxVal) * 168
            return `${x},${y}`
          }).join(' ')}
        />
        {/* Dots on actual */}
        {points.map((p: BurndownPoint, i: number) => {
          const x = 40 + (i / Math.max(points.length - 1, 1)) * 350
          const y = 178 - (p.remaining / maxVal) * 168
          return <circle key={i} cx={x} cy={y} r="3" fill="#3b82f6" />
        })}
        {/* Legend */}
        <line x1="300" y1="15" x2="320" y2="15" stroke="#3b82f6" strokeWidth="2.5" />
        <text x="325" y="19" fontSize="10" fill="#444">Actual</text>
        <line x1="300" y1="30" x2="320" y2="30" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,3" />
        <text x="325" y="34" fontSize="10" fill="#444">Ideal</text>
      </svg>
    </div>
  )
}

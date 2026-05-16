import React from 'react'

interface BudgetReportChartProps {
  planned: number
  actual: number
  currency?: string
}

export function BudgetReportChart({ planned, actual, currency = '$' }: BudgetReportChartProps) {
  const max = Math.max(planned, actual, 1)
  const plannedPct = (planned / max) * 100
  const actualPct = (actual / max) * 100
  const variance = planned - actual
  const variancePct = planned > 0 ? ((variance / planned) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Planned</span>
          <span className="font-medium">{currency}{planned.toLocaleString()}</span>
        </div>
        <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
          <div 
            className="h-full rounded-full bg-blue-500 transition-all" 
            style={{ width: `${plannedPct}%` }} 
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Actual</span>
          <span className="font-medium">{currency}{actual.toLocaleString()}</span>
        </div>
        <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
          <div 
            className="h-full rounded-full bg-green-500 transition-all" 
            style={{ width: `${actualPct}%` }} 
          />
        </div>
      </div>
      <div className="flex justify-between text-sm pt-2 border-t">
        <span className="text-muted-foreground">Variance</span>
        <span className={`font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {variance >= 0 ? '+' : ''}{currency}{variance.toLocaleString()} ({variancePct}%)
        </span>
      </div>
    </div>
  )
}

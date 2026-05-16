import React from 'react'
import Link from 'next/link'

interface BudgetLineItem {
  id: string
  description: string
  unitCost: number
  quantity: number
  totalCost: number
  workPackage?: { id: string; subject: string } | null
}

interface Budget {
  id: string
  name: string
  description: string | null
  amount: number
  lines: BudgetLineItem[]
}

interface BudgetCardProps {
  budget: Budget
  onViewDetails?: (id: string) => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function BudgetCard({ budget, onViewDetails }: BudgetCardProps) {
  const plannedAmount = budget.amount
  const lineItemsCost = budget.lines.reduce((sum, line) => sum + line.totalCost, 0)
  // For now, spent is 0 since we don't have time tracking integration in the card
  const spentAmount = 0
  const lineCount = budget.lines.length

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">{budget.name}</h3>
          {budget.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{budget.description}</p>
          )}
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-3">
          {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </span>
      </div>

      {/* Budget Amount */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500">Planned Budget</span>
          <span className="text-xl font-bold text-gray-900">{formatCurrency(plannedAmount)}</span>
        </div>
      </div>

      {/* Planned Line Items Cost */}
      <div className="mt-2 border-t border-gray-100 pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500">Line Items Cost</span>
          <span className="text-sm font-medium text-gray-700">{formatCurrency(lineItemsCost)}</span>
        </div>
      </div>

      {/* Spent (placeholder) */}
      <div className="mt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500">Actual Spent</span>
          <span className="text-sm font-medium text-gray-700">{formatCurrency(spentAmount)}</span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full"
            style={{ width: plannedAmount > 0 ? `${Math.min((spentAmount / plannedAmount) * 100, 100)}%` : '0%' }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <Link
          href={`/projects/${budget.projectId}/budgets/${budget.id}`}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View Details →
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetails?.(budget.id)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}
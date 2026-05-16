import React, { useState } from 'react'

interface BudgetLineFormProps {
  onSubmit: (data: {
    description: string
    unitCost: number
    quantity: number
    workPackageId?: string | null
  }) => Promise<void>
  onCancel?: () => void
  initialData?: {
    description?: string
    unitCost?: number
    quantity?: number
    workPackageId?: string | null
  }
  workPackages?: Array<{ id: string; subject: string }>
  isLoading?: boolean
}

export function BudgetLineForm({
  onSubmit,
  onCancel,
  initialData,
  workPackages = [],
  isLoading = false,
}: BudgetLineFormProps) {
  const [description, setDescription] = useState(initialData?.description || '')
  const [unitCost, setUnitCost] = useState(initialData?.unitCost ?? 0)
  const [quantity, setQuantity] = useState(initialData?.quantity ?? 1)
  const [workPackageId, setWorkPackageId] = useState<string>(initialData?.workPackageId || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) {
      setError('Description is required')
      return
    }
    if (unitCost < 0) {
      setError('Unit cost cannot be negative')
      return
    }
    if (quantity <= 0) {
      setError('Quantity must be positive')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        description: description.trim(),
        unitCost,
        quantity,
        workPackageId: workPackageId || null,
      })
      // Reset form after successful submit
      setDescription('')
      setUnitCost(0)
      setQuantity(1)
      setWorkPackageId('')
    } catch (err) {
      setError('Failed to add line item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalCost = unitCost * quantity

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Development hours, Equipment rental"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isSubmitting || isLoading}
        />
      </div>

      {/* Unit Cost and Quantity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit Cost ($)
          </label>
          <input
            type="number"
            value={unitCost}
            onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSubmitting || isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
            min="0.01"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSubmitting || isLoading}
          />
        </div>
      </div>

      {/* Work Package (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Work Package (optional)
        </label>
        <select
          value={workPackageId}
          onChange={(e) => setWorkPackageId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isSubmitting || isLoading}
        >
          <option value="">None</option>
          {workPackages.map((wp) => (
            <option key={wp.id} value={wp.id}>
              {wp.subject}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Link this line item to a specific work package for tracking
        </p>
      </div>

      {/* Total Cost Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Total Cost:</span>
          <span className="text-lg font-bold text-gray-900">
            ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {isSubmitting ? 'Adding...' : 'Add Line Item'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting || isLoading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
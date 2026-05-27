export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button, Modal, Input } from '@/components/ui'
import { BudgetCard } from '@/components/budgets/BudgetCard'
import { useCurrentUser } from '@/hooks/use-current-user'
import { formatDate } from '@/lib/utils'

async function fetchBudgets(projectId: string) {
  const res = await fetch(`/api/projects/${projectId}/budgets`)
  if (!res.ok) throw new Error('Failed to fetch budgets')
  return res.json()
}

async function createBudget(projectId: string, data: { name: string; description?: string; amount: number }) {
  const res = await fetch(`/api/projects/${projectId}/budgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create budget')
  return res.json()
}

export default function BudgetsIndexPage() {
  const router = useRouter()
  const { projectId } = router.query
  const queryClient = useQueryClient()
  const { user: currentUser } = useCurrentUser()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newAmount, setNewAmount] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['budgets', projectId],
    queryFn: () => fetchBudgets(projectId as string),
    enabled: !!projectId,
  })

  const budgets = data?.budgets ?? []

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; amount: number }) =>
      createBudget(projectId as string, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', projectId] })
      setIsCreateModalOpen(false)
      setNewName('')
      setNewDescription('')
      setNewAmount(0)
      setCreateError(null)
    },
    onError: (err: Error) => {
      setCreateError(err.message || 'Failed to create budget')
    },
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !currentUser?.id) return

    if (!newName.trim()) {
      setCreateError('Name is required')
      return
    }

    try {
      await createMutation.mutateAsync({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        amount: newAmount,
      })
    } catch (err) {
      console.error('Failed to create budget:', err)
    }
  }

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Project
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
              <p className="text-gray-500 text-sm mt-1">
                Manage project budgets and track spending
              </p>
            </div>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              New Budget
            </Button>
          </div>
        </div>

        {/* Budgets List */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">Loading budgets...</div>
        )}

        {error && (
          <div className="text-center py-12 text-red-500">
            Failed to load budgets. Please try again.
          </div>
        )}

        {!isLoading && !error && budgets.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No budgets yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first budget to start tracking project expenses.
              </p>
              <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                Create First Budget
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !error && budgets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((budget: any) => (
              <BudgetCard key={budget.id} budget={budget} />
            ))}
          </div>
        )}
      </div>

      {/* Create Budget Modal */}
      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Create Budget"
        description="Create a new budget for this project."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {createError}
            </div>
          )}

          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Budget name"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What is this budget for?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Planned Amount ($)
            </label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(Number(e.target.value))}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={createMutation.isPending}
            >
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </AuthenticatedLayout>
  )
}
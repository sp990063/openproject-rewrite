export const dynamic = 'force-dynamic'
import React from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { Button } from '@/components/ui'
import { useQuery } from '@tanstack/react-query'
import { BudgetReportChart } from '@/components/budgets/BudgetReportChart'
import { BudgetLineForm } from '@/components/budgets/BudgetLineForm'

async function fetchBudget(projectId: string, id: string) {
  const res = await fetch(`/api/projects/${projectId}/budgets/${id}`)
  if (!res.ok) throw new Error('Failed to fetch budget')
  return res.json()
}

async function fetchBudgetLines(projectId: string, id: string) {
  const res = await fetch(`/api/projects/${projectId}/budgets/${id}/lines`)
  if (!res.ok) throw new Error('Failed to fetch lines')
  return res.json()
}

async function fetchBudgetReport(projectId: string, id: string) {
  const res = await fetch(`/api/projects/${projectId}/budgets/${id}/report`)
  if (!res.ok) throw new Error('Failed to fetch report')
  return res.json()
}

export default function BudgetDetailPage() {
  const router = useRouter()
  const { projectId, id } = router.query as { projectId: string; id: string }

  const { data: budget } = useQuery({
    queryKey: ['budget', projectId, id],
    queryFn: () => fetchBudget(projectId, id),
    enabled: !!projectId && !!id,
  })

  const { data: lines } = useQuery({
    queryKey: ['budget-lines', projectId, id],
    queryFn: () => fetchBudgetLines(projectId, id),
    enabled: !!projectId && !!id,
  })

  const { data: report } = useQuery({
    queryKey: ['budget-report', projectId, id],
    queryFn: () => fetchBudgetReport(projectId, id),
    enabled: !!projectId && !!id,
  })

  if (!budget) return <AuthenticatedLayout><div className="p-8">Loading...</div></AuthenticatedLayout>

  return (
    <AuthenticatedLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/projects/${projectId}/budgets`} className="text-sm text-muted-foreground hover:underline">← Back to Budgets</Link>
            <h1 className="text-2xl font-bold mt-1">{budget.name}</h1>
            {budget.description && <p className="text-muted-foreground mt-1">{budget.description}</p>}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total Budget</div>
            <div className="text-2xl font-bold">${(budget.amount || 0).toLocaleString()}</div>
          </div>
        </div>

        {report && (
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Budget vs Actual</h2>
            <BudgetReportChart 
              planned={budget.amount || 0} 
              actual={report.actualCost || 0} 
            />
          </div>
        )}

        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Budget Lines</h2>
            <BudgetLineForm projectId={projectId} budgetId={id} />
          </div>
          {lines && lines.length > 0 ? (
            <div className="space-y-3">
              {lines.map((line: any) => (
                <div key={line.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div>
                    <div className="font-medium">{line.description}</div>
                    <div className="text-sm text-muted-foreground">
                      ${line.unitCost} × {line.quantity} units
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${(line.totalCost || 0).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No budget lines yet. Add one to start tracking.</p>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

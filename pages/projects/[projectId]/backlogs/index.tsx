// pages/projects/[projectId]/backlogs/index.tsx
import Head from 'next/head'
import { useState } from 'react'
import { useSprints, useCreateSprint } from '@/lib/hooks/useBacklogs'
import { SprintCard } from '@/components/backlogs/SprintCard'
import { SprintBoard } from '@/components/backlogs/SprintBoard'
import { BurndownChart } from '@/components/backlogs/BurndownChart'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { format } from 'date-fns'

interface CreateSprintForm {
  name: string
  startDate: string
  endDate: string
  capacity: string
}

interface BacklogsPageProps {
  params: { projectId: string }
}

export default function BacklogsPage({ params }: BacklogsPageProps) {
  const { projectId } = params
  const { data, isLoading } = useSprints(projectId)
  const createSprint = useCreateSprint()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateSprintForm>({
    name: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + 14 * 86400000), 'yyyy-MM-dd'),
    capacity: '',
  })

  const sprints = data?.sprints ?? []
  const selectedSprint = sprints.find((s: any) => s.id === selectedSprintId)

  const handleCreate = () => {
    createSprint.mutate({
      projectId,
      data: {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        ...(form.capacity && { capacity: parseFloat(form.capacity) }),
      },
    }, {
      onSuccess: () => {
        setShowCreate(false)
        setForm({ name: '', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(Date.now() + 14 * 86400000), 'yyyy-MM-dd'), capacity: '' })
      },
    })
  }

  return (
    <>
      <Head><title>Backlogs — Sprint Planning</title></Head>
      <div className="container mx-auto py-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Sprint Planning</h1>
          <Button onClick={() => setShowCreate(true)}>+ New Sprint</Button>
        </div>

        {/* Sprint list */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-28 animate-pulse bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : sprints.length === 0 ? (
          <div className="text-center py-12 text-gray-400 mb-8">
            No sprints yet. Create your first sprint to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {sprints.map((sprint: any) => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                onClick={() => setSelectedSprintId(selectedSprintId === sprint.id ? null : sprint.id)}
              />
            ))}
          </div>
        )}

        {/* Sprint board */}
        {selectedSprint && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{selectedSprint.name} — Board</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedSprintId(null)}>Close</Button>
            </div>
            <SprintBoard sprintId={selectedSprint.id} />
          </div>
        )}

        {/* Burndown chart */}
        {selectedSprint && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Burndown Chart</h2>
            <div className="bg-white border rounded-lg p-4">
              <BurndownChart sprintId={selectedSprint.id} />
            </div>
          </div>
        )}
      </div>

      {/* Create Sprint Modal */}
      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create Sprint">
          <div className="space-y-4 p-4">
            <Input
              label="Sprint Name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Sprint 1"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })}
              />
              <Input
                label="End Date"
                type="date"
                value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <Input
              label="Capacity (story points)"
              type="number"
              value={form.capacity}
              onChange={e => setForm({ ...form, capacity: e.target.value })}
              placeholder="40"
            />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createSprint.isPending || !form.name}>
                {createSprint.isPending ? 'Creating...' : 'Create Sprint'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

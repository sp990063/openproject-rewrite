import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { useWorkPackages, useCreateWorkPackage } from '@/hooks/use-work-packages'
import { Button, Badge, Modal, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import type { WorkPackageFilter } from '@/types'

export const dynamic = 'force-dynamic'

export default function WorkPackagesPage() {
  const router = useRouter()
  const { projectId } = router.query

  const filters: WorkPackageFilter = { projectId: projectId as string | undefined }
  const { workPackages } = useWorkPackages(filters)
  const createWorkPackage = useCreateWorkPackage()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newWPSubject, setNewWPSubject] = useState('')
  const [newWPDescription, setNewWPDescription] = useState('')

  const projectWorkPackages = workPackages.data || []

  const handleCreateWP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) return

    try {
      await createWorkPackage.mutateAsync({
        projectId: projectId as string,
        subject: newWPSubject,
        description: newWPDescription,
        statusId: 'status-new',
        typeId: 'task',
        priorityId: 'normal',
        authorId: 'system', // TODO: Get from session
      })
      setIsCreateModalOpen(false)
      setNewWPSubject('')
      setNewWPDescription('')
    } catch (error) {
      console.error('Failed to create work package:', error)
    }
  }

  const getStatusColor = (status: { color?: string; name?: string }) => {
    return status.color || '#666'
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Project
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Work Packages</h1>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            New Work Package
          </Button>
        </div>

        {workPackages.isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : projectWorkPackages.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectWorkPackages.map((wp) => (
                  <TableRow key={wp.id}>
                    <TableCell className="font-medium">{wp.subject}</TableCell>
                    <TableCell>
                      <Badge
                        variant={wp.status?.isClosed ? 'default' : 'info'}
                        style={{ backgroundColor: getStatusColor(wp.status || {}) + '20', color: getStatusColor(wp.status || {}) }}
                      >
                        {wp.status?.name}
                      </Badge>
                    </TableCell>
                    <TableCell>{wp.type?.name}</TableCell>
                    <TableCell>{wp.priority?.name}</TableCell>
                    <TableCell>{wp.assignee?.name || 'Unassigned'}</TableCell>
                    <TableCell>{wp.dueDate ? formatDate(wp.dueDate) : 'No date'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-4">No work packages yet</p>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              Create your first work package
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Create Work Package"
        description="Create a new work package for this project."
      >
        <form onSubmit={handleCreateWP} className="space-y-4">
          <Input
            label="Subject"
            value={newWPSubject}
            onChange={(e) => setNewWPSubject(e.target.value)}
            placeholder="Work package subject"
            required
          />
          <Input
            label="Description"
            value={newWPDescription}
            onChange={(e) => setNewWPDescription(e.target.value)}
            placeholder="Optional description"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={createWorkPackage.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </AuthenticatedLayout>
  )
}

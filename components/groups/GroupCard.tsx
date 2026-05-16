import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui'
import { Group } from '@prisma/client'

type GroupWithCount = Group & { _count: { members: number } }

interface GroupCardProps {
  group: GroupWithCount
  onDelete: (id: string) => void
  isDeleting?: boolean
}

export function GroupCard({ group, onDelete, isDeleting }: GroupCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Link href={`/admin/groups/${group.id}`} className="text-lg font-medium text-gray-900 hover:text-blue-600">
            {group.name}
          </Link>
          <p className="text-sm text-gray-500 mt-1">
            {group._count.members} {group._count.members === 1 ? 'member' : 'members'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/groups/${group.id}`}>
            <Button variant="secondary" size="sm">
              View
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(group.id)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}

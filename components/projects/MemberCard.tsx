import React from 'react'
import { Button, TableCell } from '@/components/ui'
import type { ProjectMember } from '@/types/project'

interface MemberCardProps {
  member: ProjectMember
  onEditRole?: (member: ProjectMember) => void
  onRemove?: (memberId: string) => void
  isRemoving?: boolean
}

export function MemberCard({ member, onEditRole, onRemove, isRemoving }: MemberCardProps) {
  const initials = member.user?.name?.charAt(0) || '?'

  return (
    <tr className="hover:bg-gray-50">
      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
            {initials}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">
              {member.user?.name || 'Unknown'}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap">
        <p className="text-sm text-gray-500">{member.user?.email || '-'}</p>
      </TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {member.role?.name || 'Unknown'}
        </span>
      </TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap text-right text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEditRole?.(member)}
        >
          Edit Role
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove?.(member.id)}
          disabled={isRemoving}
          className="text-red-600 hover:text-red-900 ml-2"
        >
          {isRemoving ? 'Removing...' : 'Remove'}
        </Button>
      </TableCell>
    </tr>
  )
}
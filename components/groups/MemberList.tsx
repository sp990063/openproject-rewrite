import React from 'react'
import { Button } from '@/components/ui'

interface User {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface Member {
  id: string
  user: User
  addedAt: string
}

interface MemberListProps {
  members: Member[]
  onRemove: (userId: string) => void
  isRemoving?: boolean
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function MemberList({ members, onRemove, isRemoving }: MemberListProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No members in this group yet.
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {member.user.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{member.user.name || 'Unknown'}</p>
              <p className="text-xs text-gray-500">{member.user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(member.user.id)}
            disabled={isRemoving}
            className="text-gray-400 hover:text-red-600"
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

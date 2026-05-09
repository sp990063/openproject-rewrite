// components/backlogs/SprintCard.tsx
import { Sprint } from '@/lib/hooks/useBacklogs'
import { format, differenceInDays } from 'date-fns'
import { Badge } from '@/components/ui/Badge'

interface SprintCardProps {
  sprint: Sprint
  onClick?: () => void
}

export function SprintCard({ sprint, onClick }: SprintCardProps) {
  const daysLeft = differenceInDays(new Date(sprint.endDate), new Date())
  const isActive = sprint.status === 'ACTIVE'
  const isClosed = sprint.status === 'CLOSED'

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-shadow hover:shadow-md
        ${isActive ? 'border-blue-400 bg-blue-50' : isClosed ? 'border-gray-200 bg-gray-50 opacity-75' : 'border-gray-200 bg-white'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{sprint.name}</h3>
        <Badge variant={isActive ? 'info' : isClosed ? 'default' : 'warning'}>
          {sprint.status}
        </Badge>
      </div>
      <div className="text-sm text-gray-500 space-y-1">
        <p>{format(new Date(sprint.startDate), 'MMM d')} – {format(new Date(sprint.endDate), 'MMM d, yyyy')}</p>
        <p>{daysLeft >= 0 ? `${daysLeft} days remaining` : `${Math.abs(daysLeft)} days overdue`}</p>
        {sprint.capacity != null && <p>Capacity: {sprint.capacity} pts</p>}
        {sprint.velocity != null && <p>Velocity: {sprint.velocity} pts</p>}
      </div>
    </div>
  )
}

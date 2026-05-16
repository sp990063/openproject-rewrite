import React from 'react'
import { cn } from '@/lib/utils'

interface MeetingAgendaItem {
  id: string
  meetingId: string
  title: string
  notes?: string | null
  duration?: number | null
  position: number
}

interface MeetingAgendaTabProps {
  agendaItems?: MeetingAgendaItem[]
  className?: string
}

export function MeetingAgendaTab({
  agendaItems = [],
  className,
}: MeetingAgendaTabProps) {
  if (agendaItems.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-500">No agenda items yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Add agenda items to structure your meeting
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Agenda Items ({agendaItems.length})
        </h3>
        <span className="text-sm text-gray-500">
          Total duration: {agendaItems.reduce((sum, item) => sum + (item.duration || 0), 0)} min
        </span>
      </div>

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
        {agendaItems.map((item, index) => (
          <div key={item.id} className="px-4 py-4">
            <div className="flex items-start gap-4">
              {/* Position number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-sm font-medium text-blue-700">
                  {index + 1}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900">
                  {item.title}
                </h4>

                {/* Notes */}
                {item.notes && (
                  <p className="mt-1 text-sm text-gray-500 whitespace-pre-wrap">
                    {item.notes}
                  </p>
                )}

                {/* Duration */}
                {item.duration && (
                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {item.duration} minutes
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

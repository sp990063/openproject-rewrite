// components/my-page/widgets/UpcomingMeetingsWidget.tsx
// 即將到來的會議部件
'use client';

import { useMemo } from 'react';
import { format, addDays, isBefore, isAfter } from 'date-fns';
import { useMeetings, type Meeting } from '@/hooks/useMeetings';
import { cn } from '@/lib/utils';

interface UpcomingMeetingsWidgetProps {
  config?: { projectId?: string; daysAhead?: number };
}

export function UpcomingMeetingsWidget({ config }: UpcomingMeetingsWidgetProps) {
  const daysAhead = config?.daysAhead ?? 7;
  const projectId = config?.projectId;

  const { data: allMeetings = [], isLoading } = useMeetings(projectId, {
    startAfter: new Date().toISOString(),
    endBefore: addDays(new Date(), daysAhead).toISOString(),
  });

  // 過濾並排序即將到來的會議
  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    return allMeetings
      .filter((meeting: Meeting) => {
        const start = new Date(meeting.startTime);
        return isAfter(start, now) && isBefore(start, addDays(now, daysAhead));
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 10);
  }, [allMeetings, daysAhead]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (upcomingMeetings.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        No upcoming meetings
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {upcomingMeetings.map((meeting) => (
        <div key={meeting.id} className="flex items-start gap-3 text-sm">
          {/* 日期時間 */}
          <div className="text-gray-500 min-w-[80px]">
            <div className="font-medium">
              {format(new Date(meeting.startTime), 'MMM d')}
            </div>
            <div className="text-xs">
              {format(new Date(meeting.startTime), 'HH:mm')}
            </div>
          </div>

          {/* 會議詳情 */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {meeting.title}
            </div>
            {meeting.project && (
              <div className="text-xs text-gray-500 truncate">
                {meeting.project.name}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

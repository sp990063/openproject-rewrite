// components/my-page/widgets/TimeEntriesWidget.tsx
// 本週工時部件
'use client';

import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { cn } from '@/lib/utils';

interface TimeEntriesWidgetProps {
  config?: { days?: number };
}

export function TimeEntriesWidget({ config }: TimeEntriesWidgetProps) {
  // 獲取本週的開始和結束日期
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const filters = {
    from: format(weekStart, 'yyyy-MM-dd'),
    to: format(weekEnd, 'yyyy-MM-dd'),
  };

  const { data: entries = [], isLoading } = useTimeEntries(filters);

  const totalHours = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [entries]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        No time logged this week
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 本週總工時 */}
      <div className="text-sm text-gray-600">
        This week: <span className="font-semibold text-gray-900">{totalHours.toFixed(2)}h</span>
      </div>

      {/* 工時列表 */}
      <div className="space-y-2">
        {entries.slice(0, 10).map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 text-sm">
            {/* 日期 */}
            <div className="text-gray-500 min-w-[60px]">
              {format(new Date(entry.spentOn), 'MMM d')}
            </div>

            {/* 工作包主題 */}
            <div className="flex-1 min-w-0 text-gray-700 truncate">
              {entry.workPackage?.subject ?? `WP #${entry.workPackageId}`}
            </div>

            {/* 工時 */}
            <div className="font-medium text-gray-900">
              {entry.hours.toFixed(2)}h
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

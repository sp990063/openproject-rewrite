// components/my-page/MyPageWidget.tsx
// 我的頁面通用部件包裝器
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { MyPageWidget as MyPageWidgetType } from '@/hooks/useMyPage';
import { AssignedWorkPackagesWidget } from './widgets/AssignedWorkPackagesWidget';
import { TimeEntriesWidget } from './widgets/TimeEntriesWidget';
import { UpcomingMeetingsWidget } from './widgets/UpcomingMeetingsWidget';

interface MyPageWidgetProps {
  widget: MyPageWidgetType;
  editMode?: boolean;
}

const WIDGET_TITLES: Record<string, string> = {
  assigned_work_packages: 'Assigned Work Packages',
  watched_work_packages: 'Watched Work Packages',
  recent_projects: 'Recent Projects',
  time_entries_this_week: 'Time Entries This Week',
  upcoming_meetings: 'Upcoming Meetings',
  news: 'News',
  custom_query: 'Custom Query',
};

export function MyPageWidget({ widget, editMode = false }: MyPageWidgetProps) {
  const [isCollapsed, setIsCollapsed] = useState(widget.collapsed);

  const title = WIDGET_TITLES[widget.type] ?? widget.type;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* 部件標題栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>

        <div className="flex items-center gap-2">
          {/* 摺疊/展開按鈕 */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={cn(
                'w-4 h-4 text-gray-500 transition-transform',
                isCollapsed && '-rotate-90'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 編輯模式控制 */}
          {editMode && (
            <div className="flex gap-1">
              <button className="p-1 hover:bg-gray-100 rounded text-gray-500 text-xs">
                ✕ Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 部件內容 */}
      {!isCollapsed && (
        <div className="p-4">
          {renderWidgetContent(widget)}
        </div>
      )}
    </div>
  );
}

function renderWidgetContent(widget: MyPageWidgetType) {
  switch (widget.type) {
    case 'assigned_work_packages':
      return (
        <AssignedWorkPackagesWidget
          config={widget.config as { statusFilter?: string[] } | undefined}
        />
      );
    case 'time_entries_this_week':
      return (
        <TimeEntriesWidget
          config={widget.config as { days?: number } | undefined}
        />
      );
    case 'upcoming_meetings':
      return (
        <UpcomingMeetingsWidget
          config={widget.config as { projectId?: string; daysAhead?: number } | undefined}
        />
      );
    case 'watched_work_packages':
      // 暫時使用相同組件
      return (
        <AssignedWorkPackagesWidget
          config={widget.config as { statusFilter?: string[] } | undefined}
        />
      );
    case 'recent_projects':
      return <div className="text-sm text-gray-500">Recent projects widget</div>;
    case 'news':
      return <div className="text-sm text-gray-500">News widget</div>;
    case 'custom_query':
      return <div className="text-sm text-gray-500">Custom query widget</div>;
    default:
      return <div className="text-sm text-gray-500">Unknown widget type</div>;
  }
}

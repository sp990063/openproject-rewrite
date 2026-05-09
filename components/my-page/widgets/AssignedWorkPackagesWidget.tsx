// components/my-page/widgets/AssignedWorkPackagesWidget.tsx
// 指派給我的工作包部件
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useWorkPackages } from '@/hooks/use-work-packages';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface AssignedWorkPackagesWidgetProps {
  config?: { statusFilter?: string[] };
}

const TYPE_COLORS: Record<string, string> = {
  bug: 'bg-red-500',
  task: 'bg-blue-500',
  feature: 'bg-green-500',
  milestone: 'bg-purple-500',
};

export function AssignedWorkPackagesWidget({ config }: AssignedWorkPackagesWidgetProps) {
  const filters = {
    assigneeId: ['me'] as string[],
    ...(config?.statusFilter && { statusId: config.statusFilter }),
  };

  const { workPackages } = useWorkPackages(filters);

  const isLoading = workPackages.isLoading;
  const items = useMemo(() => {
    return (workPackages.data ?? []).slice(0, 10);
  }, [workPackages.data]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        No assigned work packages
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((wp) => {
        const typeKey = wp.type?.name?.toLowerCase() ?? 'task';
        const typeColor = TYPE_COLORS[typeKey] ?? 'bg-gray-500';

        return (
          <div key={wp.id} className="flex items-center gap-2 text-sm">
            {/* 類型顏色指示器 */}
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', typeColor)} />

            {/* 工作包主題 */}
            <Link
              href={`/projects/${wp.projectId}/work-packages/${wp.id}`}
              className="flex-1 min-w-0 text-gray-700 hover:text-blue-600 truncate"
            >
              {wp.subject}
            </Link>

            {/* 狀態徽章 */}
            {wp.status && (
              <Badge variant="default" className="flex-shrink-0">
                {wp.status.name}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

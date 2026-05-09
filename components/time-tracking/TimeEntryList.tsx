// components/time-tracking/TimeEntryList.tsx
// 工時條目列表組件
'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { useWorkPackageTimeEntries } from '@/hooks/useTimeEntries';
import { useSubmitTimeEntry, useApproveTimeEntry, useRejectTimeEntry } from '@/hooks/useTimeEntryMutations';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface TimeEntryListProps {
  workPackageId: string;
  className?: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'danger'> = {
  pending: 'default',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function TimeEntryList({ workPackageId, className }: TimeEntryListProps) {
  const { data: entries = [], isLoading } = useWorkPackageTimeEntries(workPackageId);
  const { user } = useCurrentUser();

  const submitEntry = useSubmitTimeEntry();
  const approveEntry = useApproveTimeEntry();
  const rejectEntry = useRejectTimeEntry();

  // 計算總工時
  const totalHours = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [entries]);

  // 簡單的角色判斷：用戶名稱匹配或系統管理員可審批
  const canApprove = user?.isSystemAdmin ?? false;

  const handleSubmit = async (id: string) => {
    try {
      await submitEntry.mutateAsync(id);
    } catch (error) {
      console.error('Failed to submit entry:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveEntry.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve entry:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectEntry.mutateAsync({ id });
    } catch (error) {
      console.error('Failed to reject entry:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* 標題栏：標題 + 總工時 */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Time Tracking</h3>
        <span className="text-sm text-gray-600">
          Total: <span className="font-medium">{totalHours.toFixed(2)}h</span>
        </span>
      </div>

      {/* 空狀態 */}
      {entries.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No time logged yet</p>
        </div>
      )}

      {/* 工時條目列表 */}
      <div className="divide-y divide-gray-100">
        {entries.map((entry) => {
          const isOwn = entry.userId === user?.id;
          const canSubmit = isOwn && entry.status === 'pending';
          const canApproveReject = canApprove && entry.status === 'submitted';

          return (
            <div key={entry.id} className="py-3 flex items-start gap-3">
              {/* 日期 */}
              <div className="text-sm text-gray-500 min-w-[60px]">
                {format(new Date(entry.spentOn), 'MMM d')}
              </div>

              {/* 工時 */}
              <div className="font-medium text-gray-900 min-w-[50px]">
                {entry.hours.toFixed(2)}h
              </div>

              {/* 備註 */}
              <div className="flex-1 min-w-0">
                {entry.comment && (
                  <p className="text-sm text-gray-600 truncate">{entry.comment}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {entry.user?.name ?? 'Unknown user'}
                </p>
              </div>

              {/* 狀態徽章 */}
              <Badge variant={STATUS_VARIANT[entry.status]}>
                {STATUS_LABEL[entry.status]}
              </Badge>

              {/* 操作按鈕 */}
              <div className="flex gap-1">
                {canSubmit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSubmit(entry.id)}
                    isLoading={submitEntry.isPending}
                  >
                    Submit
                  </Button>
                )}
                {canApproveReject && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleApprove(entry.id)}
                      isLoading={approveEntry.isPending}
                      className="text-green-600 hover:text-green-700"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReject(entry.id)}
                      isLoading={rejectEntry.isPending}
                      className="text-red-600 hover:text-red-700"
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

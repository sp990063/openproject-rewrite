// components/time-tracking/LogTimeDialog.tsx
// 記錄工作工時對話框
'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogTime } from '@/hooks/useTimeEntryMutations';

interface LogTimeDialogProps {
  workPackage: { id: string; subject: string };
  onClose: () => void;
}

export function LogTimeDialog({ workPackage, onClose }: LogTimeDialogProps) {
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState('');

  const logTime = useLogTime();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum <= 0) return;

    try {
      await logTime.mutateAsync({
        workPackageId: workPackage.id,
        hours: hoursNum,
        spentOn: date,
        comment: comment || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to log time:', error);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Log Time: ${workPackage.subject}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 工時輸入 */}
        <Input
          type="number"
          label="Hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          min="0.25"
          max="24"
          step="0.25"
          placeholder="0.00"
          required
        />

        {/* 日期輸入 */}
        <Input
          type="date"
          label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        {/* 備註輸入 */}
        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
            Comment (optional)
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="What did you work on?"
          />
        </div>

        {/* 操作按鈕 */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={logTime.isPending}
            disabled={!hours || parseFloat(hours) <= 0}
          >
            Log Time
          </Button>
        </div>
      </form>
    </Modal>
  );
}

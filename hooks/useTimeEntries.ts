import { useQuery } from '@tanstack/react-query';
import type { TimeEntry } from '@/types/time-tracking';

interface TimeEntryFilters {
  userId?: string;
  projectId?: string;
  workPackageId?: string;
  from?: string;
  to?: string;
}

export function useTimeEntries(filters: TimeEntryFilters = {}) {
  return useQuery({
    queryKey: ['time-entries', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.workPackageId) params.set('workPackageId', filters.workPackageId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await fetch(`/api/time-entries?${params}`);
      if (!res.ok) throw new Error('Failed to fetch time entries');
      const json = await res.json();
      return json.data.entries as TimeEntry[];
    },
  });
}

export function useWorkPackageTimeEntries(workPackageId: string) {
  return useQuery({
    queryKey: ['time-entries', 'work-package', workPackageId],
    queryFn: async () => {
      const res = await fetch(`/api/work-packages/${workPackageId}/time-entries`);
      if (!res.ok) throw new Error('Failed to fetch work package time entries');
      const json = await res.json();
      return json.data.entries as TimeEntry[];
    },
    enabled: !!workPackageId,
  });
}

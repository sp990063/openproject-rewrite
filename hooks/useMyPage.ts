// hooks/useMyPage.ts
// 我的頁面部件查詢及保存鉤子
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WidgetType } from '@/types/my-page';

export interface MyPageWidget {
  id: string;
  userId: string;
  type: WidgetType;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
  collapsed: boolean;
}

export function useMyPage() {
  return useQuery({
    queryKey: ['my-page'],
    queryFn: async () => {
      const res = await fetch('/api/my-page');
      if (!res.ok) throw new Error('Failed to fetch my page');
      const json = await res.json();
      return json.data.widgets as MyPageWidget[];
    },
  });
}

export function useSaveMyPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (widgets: MyPageWidget[]) => {
      const res = await fetch('/api/my-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets }),
      });
      if (!res.ok) throw new Error('Failed to save my page');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-page'] });
    },
  });
}

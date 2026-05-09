export interface TimeEntry {
  id: string;
  workPackageId: string;
  userId: string;
  hours: number;
  comment: string | null;
  spentOn: string; // ISO date string
  userTimezone: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  approvedBy: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated relations
  workPackage?: { id: string; subject: string; estimatedHours: number | null };
  user?: { id: string; name: string };
  approver?: { id: string; name: string } | null;
  // Computed
  overtimeHours?: number | null;
}

export interface TimeEntrySummary {
  workPackageId: string;
  totalHours: number;
  entries: TimeEntry[];
}

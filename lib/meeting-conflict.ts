/**
 * Meeting conflict detection — H1 HIGH fix
 *
 * Prevents double-booking attendees when two meetings overlap in time
 * and share at least one participant.
 */
import { prisma } from './prisma';

interface ConflictCheckParams {
  projectId: string;
  attendees: string[];
  startTime: Date;
  endTime: Date;
  excludeMeetingId?: string;
}

interface ConflictResult {
  hasConflict: boolean;
  conflictingMeetings: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    attendees: string[];
  }>;
}

export async function checkMeetingConflict(
  params: ConflictCheckParams
): Promise<ConflictResult> {
  const { projectId, attendees, startTime, endTime, excludeMeetingId } = params;

  if (attendees.length === 0) {
    return { hasConflict: false, conflictingMeetings: [] };
  }

  // Find meetings in the same project that overlap in time AND share any attendee
  // Time overlap: newStart < existingEnd AND newEnd > existingStart
  const overlapping = await prisma.meeting.findMany({
    where: {
      projectId,
      id: excludeMeetingId ? { not: excludeMeetingId } : undefined,
      startTime: { lt: endTime },
      // Must share at least one attendee (relation name: attendees)
      attendees: {
        some: { userId: { in: attendees } },
      },
    },
    include: {
      attendees: { select: { userId: true } },
    },
  });

  return {
    hasConflict: overlapping.length > 0,
    conflictingMeetings: overlapping.map((m) => ({
      id: m.id,
      title: m.title,
      startTime: m.startTime,
      endTime: m.endTime,
      attendees: m.attendees.map((p) => p.userId),
    })),
  };
}

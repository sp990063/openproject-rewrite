// pages/api/email/send.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { sendEmail, queueEmail } from '@/lib/email';
import { getWorkPackageAssignedTemplate, getMentionTemplate, getMeetingInvitationTemplate } from '@/lib/email/templates';

const SendEmailSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  template: z.enum(['work_package_assigned', 'mention', 'meeting_invitation']),
  data: z.record(z.string(), z.unknown()),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Not authenticated'));
  }

  if (req.method !== 'POST') {
    return res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed'));
  }

  // Only admins or system can send emails
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: { role: true },
  });
  if (!membership || !['Admin', 'Project Manager'].includes(membership.role?.name ?? '')) {
    return res.status(403).json(errorResponse('FORBIDDEN', 'Not authorized to send emails'));
  }

  const parsed = SendEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input'));
  }

  const { to, template, data } = parsed.data;
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://openproject.example.com';

  let html: string;
  let subject: string;

  switch (template) {
    case 'work_package_assigned': {
      const d = data as { assigneeName: string; workPackageSubject: string; projectName: string; workPackageUrl: string; assignedByName?: string };
      html = getWorkPackageAssignedTemplate({ ...d, baseUrl });
      subject = `[OpenProject] Assigned to: ${d.workPackageSubject}`;
      break;
    }
    case 'mention': {
      const d = data as { mentionedName: string; resourceType: string; resourceSubject: string; resourceUrl: string; mentionedByName: string };
      html = getMentionTemplate({ ...d, baseUrl });
      subject = `[OpenProject] You were mentioned in: ${d.resourceSubject}`;
      break;
    }
    case 'meeting_invitation': {
      const d = data as { inviteeName: string; meetingTitle: string; meetingDate: string; meetingUrl: string; projectName: string; organizerName: string };
      html = getMeetingInvitationTemplate({ ...d, baseUrl });
      subject = `[OpenProject] Meeting invitation: ${d.meetingTitle}`;
      break;
    }
  }

  // Try to send immediately, queue if it fails
  const result = await sendEmail({ to, subject, html });

  if (!result.success) {
    // Queue for later retry
    await queueEmail({ to, subject, html }, prisma);
    console.warn('[Email] Queued email for later delivery:', result.error);
  }

  return res.json(successResponse({
    sent: result.success,
    id: result.id,
    queued: !result.success,
  }));
}

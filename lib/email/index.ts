// lib/email/index.ts
// Phase 6: Production email delivery via Resend

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  scheduledAt?: Date;
}

interface ResendEmailResult {
  id?: string;
  error?: { message: string };
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const { to, subject, html } = options;
  
  // If Resend is not configured, queue email for later processing
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set, email queued locally');
    return { success: false, error: 'Email provider not configured' };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const recipients = Array.isArray(to) ? to : [to];
    const fromEmail = process.env.EMAIL_FROM ?? 'noreply@openproject.local';

    const result = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      html,
    }) as ResendEmailResult;

    if (result.error) {
      console.error('[Email] Resend error:', result.error.message);
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[Email] Failed to send:', message);
    return { success: false, error: message };
  }
}

// Queue email in database for async processing
export async function queueEmail(options: Omit<SendEmailOptions, 'scheduledAt'> & { scheduledAt?: Date }, prisma: any) {
  const { to, subject, html, scheduledAt = new Date() } = options;
  
  const email = await prisma.emailQueue.create({
    data: {
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      html,
      scheduledAt,
    },
  });
  
  return email;
}

// Process email queue (called by a cron job or background worker)
export async function processEmailQueue(prisma: any, batchSize = 10) {
  const pending = await prisma.emailQueue.findMany({
    where: {
      processedAt: null,
      scheduledAt: { lte: new Date() },
      attempts: { lt: 3 },
    },
    take: batchSize,
    orderBy: { scheduledAt: 'asc' },
  });

  const results = await Promise.allSettled(
    pending.map(async (email: any) => {
      const result = await sendEmail({
        to: email.to.split(','),
        subject: email.subject,
        html: email.html,
      });

      if (result.success) {
        await prisma.emailQueue.update({
          where: { id: email.id },
          data: { processedAt: new Date() },
        });
      } else {
        await prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            attempts: { increment: 1 },
            lastError: result.error,
          },
        });
      }

      return result;
    })
  );

  return { processed: pending.length, results };
}

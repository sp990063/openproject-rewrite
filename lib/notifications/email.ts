// lib/notifications/email.ts
//
// Spec §3.5.1: `sendInviteEmail` wrapper for project invites. The
// underlying transport + HTML rendering lives in `lib/email/`; this
// thin module is the spec-mandated import path used by the invite
// endpoints (`@/lib/notifications/email`). It composes the existing
// `sendEmail` + `getProjectInvitationTemplate` into a single call so
// the route handlers stay focused on RBAC + persistence.

import { sendEmail } from '@/lib/email'
import { getProjectInvitationTemplate, type ProjectInvitationData } from '@/lib/email/templates'

export interface SendInviteEmailOptions extends ProjectInvitationData {
  to: string
  subject?: string
}

/**
 * Send a project invitation email.
 *
 * - Builds the HTML body via `getProjectInvitationTemplate`
 * - Hands off to `sendEmail` (Resend in prod, console.warn + queue in
 *   dev when `RESEND_API_KEY` is not set)
 * - Returns the same `{ success, id?, error? }` shape as `sendEmail`
 *
 * On dev/staging where Resend is not configured, the email is logged
 * to stdout instead — callers should still treat the invite as
 * successfully created (the DB row is the source of truth for the
 * token, not the email delivery).
 */
export async function sendInviteEmail(
  options: SendInviteEmailOptions,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const html = getProjectInvitationTemplate(options)
  const subject = options.subject ?? `Invitation to ${options.projectName}`

  return sendEmail({
    to: options.to,
    subject,
    html,
  })
}

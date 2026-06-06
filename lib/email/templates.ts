// lib/email/templates.ts
// Phase 6: Email templates for notifications

interface BaseTemplateData {
  baseUrl?: string;
}

interface WorkPackageAssignedData extends BaseTemplateData {
  assigneeName: string;
  workPackageSubject: string;
  projectName: string;
  workPackageUrl: string;
  assignedByName?: string;
}

interface MentionData extends BaseTemplateData {
  mentionedName: string;
  resourceType: string;
  resourceSubject: string;
  resourceUrl: string;
  mentionedByName: string;
}

interface MeetingInvitationData extends BaseTemplateData {
  inviteeName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingUrl: string;
  projectName: string;
  organizerName: string;
}

export interface ProjectInvitationData extends BaseTemplateData {
  invitedByName: string;
  projectName: string;
  roleName?: string;
  acceptUrl: string;
  expiresAt: string; // Human-readable, e.g. "June 13, 2026"
}

function baseTemplate(content: string, footer?: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .content { background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; }
    .content p { margin: 0 0 16px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .button:hover { background: #1d4ed8; }
    .footer { text-align: center; padding: 16px; color: #6b7280; font-size: 13px; }
    .highlight { background: white; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>OpenProject</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    ${footer ? `<div class="footer">${footer}</div>` : ''}
  </div>
</body>
</html>
  `.trim();
}

export function getWorkPackageAssignedTemplate(data: WorkPackageAssignedData) {
  const baseUrl = data.baseUrl ?? 'https://openproject.example.com';
  const content = `
    <p>Hello ${data.assigneeName},</p>
    <p>You have been <strong>assigned</strong> to a work package:</p>
    <div class="highlight">
      <strong>${data.workPackageSubject}</strong><br>
      Project: ${data.projectName}
    </div>
    ${data.assignedByName ? `<p>Assigned by: ${data.assignedByName}</p>` : ''}
    <p><a href="${data.workPackageUrl}" class="button">View Work Package</a></p>
    <p style="margin-top: 24px; color: #6b7280; font-size: 13px;">
      You received this email because you were assigned to this work package.
    </p>
  `;
  return baseTemplate(content);
}

export function getMentionTemplate(data: MentionData) {
  const baseUrl = data.baseUrl ?? 'https://openproject.example.com';
  const content = `
    <p>Hello ${data.mentionedName},</p>
    <p><strong>${data.mentionedByName}</strong> mentioned you in a ${data.resourceType}:</p>
    <div class="highlight">
      <strong>${data.resourceSubject}</strong>
    </div>
    <p><a href="${data.resourceUrl}" class="button">View ${data.resourceType}</a></p>
  `;
  return baseTemplate(content);
}

export function getMeetingInvitationTemplate(data: MeetingInvitationData) {
  const baseUrl = data.baseUrl ?? 'https://openproject.example.com';
  const content = `
    <p>Hello ${data.inviteeName},</p>
    <p>You've been invited to a meeting:</p>
    <div class="highlight">
      <strong>${data.meetingTitle}</strong><br>
      Date: ${data.meetingDate}<br>
      Project: ${data.projectName}<br>
      Organizer: ${data.organizerName}
    </div>
    <p><a href="${data.meetingUrl}" class="button">View Meeting</a></p>
  `;
  return baseTemplate(content);
}

export function getPasswordResetTemplate(resetUrl: string, userName: string) {
  const content = `
    <p>Hello ${userName},</p>
    <p>You requested a password reset. Click the button below to reset your password:</p>
    <p><a href="${resetUrl}" class="button">Reset Password</a></p>
    <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
      This link expires in 1 hour. If you didn't request a password reset, please ignore this email.
    </p>
  `;
  return baseTemplate(content);
}

export function getProjectInvitationTemplate(data: ProjectInvitationData) {
  const content = `
    <p>Hello,</p>
    <p>${data.invitedByName} has invited you to join the project
    <strong>${data.projectName}</strong>${data.roleName ? ` as a <strong>${data.roleName}</strong>` : ''}.</p>
    <p>This invitation expires on ${data.expiresAt}.</p>
    <p><a href="${data.acceptUrl}" class="button">Accept Invitation</a></p>
    <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
      If you don't have an account yet, you'll be asked to create one when you accept.
    </p>
  `;
  return baseTemplate(content);
}

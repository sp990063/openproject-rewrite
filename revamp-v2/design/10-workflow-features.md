# OpenProject Rewrite — Workflow & Feature Overhaul Design

**Document:** 10-workflow-features.md
**Author:** Senior PM & Workflow Expert (former OpenProject power user)
**Version:** 1.0 — Revamp v2
**Date:** 2026-06-06
**Status:** Design — no code changes

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit (Feature Inventory)](#2-current-state-audit-feature-inventory)
3. [Work Packages Overhaul](#3-work-packages-overhaul)
4. [Boards Overhaul](#4-boards-overhaul)
5. [Gantt Overhaul](#5-gantt-overhaul)
6. [Project Hierarchy](#6-project-hierarchy)
7. [Members, Roles & Identity](#7-members-roles--identity)
8. [Time Tracking](#8-time-tracking)
9. [Budgets & Cost Tracking](#9-budgets--cost-tracking)
10. [Meetings](#10-meetings)
11. [Forums](#11-forums)
12. [Wiki](#12-wiki)
13. [Documents & File Storage](#13-documents--file-storage)
14. [News & Announcements](#14-news--announcements)
15. [Calendar](#15-calendar)
16. [Notifications](#16-notifications)
17. [Search](#17-search)
18. [Reports & Analytics](#18-reports--analytics)
19. [NEW Features Beyond Original OpenProject](#19-new-features-beyond-original-openproject)
20. [Workflow Definitions (Methodology)](#20-workflow-definitions-methodology)
21. [Permission Matrix](#21-permission-matrix)
22. [Notification Triggers](#22-notification-triggers)
23. [Webhook Events](#23-webhook-events)
24. [Implementation Roadmap](#24-implementation-roadmap)
25. [Top 5 Feature Improvements — Summary](#25-top-5-feature-improvements--summary)

---

## 1. Executive Summary

This document defines the workflow and feature overhaul for the OpenProject Next.js rewrite (`/home/cwlai/openproject-rewrite`). The rewrite currently achieves roughly 92% feature coverage of the original Ruby on Rails OpenProject (https://github.com/opf/openproject) but lags in several areas that modern users expect from tools like Asana, Linear, Jira, ClickUp, and Notion.

The goal of this overhaul is not just to catch up, but to leapfrog competitors in three areas:

1. **Workflow flexibility** — true per-role, per-type, per-project workflow engines with visual state-machine editing.
2. **Integrated automation** — native trigger→condition→action builder so administrators can replace Zapier/Make with built-in rules.
3. **AI-assisted delivery** — assignee suggestion, duration prediction, and thread summarisation as first-class features, not bolt-ons.

All design choices respect the existing tech stack constraints (Next.js 15 Pages Router, Prisma 7, NextAuth v5, TanStack Query, Radix UI, Tailwind v4) and the existing Prisma schema (64 models observed). No code is changed in this document; it is a pure design deliverable.

### 1.1 Guiding principles

- **Self-service admin** — every workflow concept (status, type, role, form, rule) is configurable through the web UI; no SQL or code change required.
- **Least-surprise UX** — defaults match OpenProject's existing behaviour, but the model is expressive enough to model Scrum, Kanban, Waterfall, and Hybrid flows simultaneously.
- **API-first** — every configuration and every entity is accessible through API v3 (already in place) and webhooks.
- **Performance budget** — boards and tables must remain interactive at 10,000+ work packages per project.
- **Backward compatibility** — migration scripts preserve existing data; new fields default to safe values.

### 1.2 Document conventions

- **MUST / SHOULD / MAY** follow RFC 2119 wording.
- Tables describe **role × action × resource** matrices.
- All new database additions are noted with proposed Prisma model names.
- Diagrams use Mermaid syntax for inline rendering on GitHub/IDE previews.

---

## 2. Current State Audit (Feature Inventory)

This section audits every feature listed in the existing rewrite and benchmarks it against (a) the original OpenProject, (b) modern competitors, and (c) our own desired state.

### 2.1 Work Packages

| Aspect | Status today | Original OpenProject | Asana/Linear/Jira/ClickUp/Notion | Action |
|---|---|---|---|---|
| CRUD | Implemented | ✅ | ✅ | Keep |
| Custom fields per type | Implemented | ✅ | ✅ | Keep |
| Statuses | Implemented (model `Status`) | ✅ | ✅ | Keep |
| Priorities | Implemented (model `Priority`) | ✅ | ✅ | Keep + add visual icons |
| Types | Implemented (model `Type`) | ✅ | ✅ | Keep + add icon + colour per type |
| Versions/milestones | Implemented (model `Version`) | ✅ | ✅ | Keep |
| Categories | **Missing** | ✅ | ✅ (Asana tags) | Add `WorkPackageCategory` model |
| Severities | **Missing** | ✅ (plugin) | ✅ (Jira) | Add `Severity` enum-like model |
| Watchers | Implemented (per WP) | ✅ | ✅ | Keep + bulk-watch |
| Activities/comments | Implemented (`Activity`, `ActivityComment`) | ✅ | ✅ | Keep + add @mentions + reactions |
| Assignee + responsible | Implemented | ✅ | ✅ | Keep |
| Workflows (state machine) | **Missing** | ✅ | ✅ (Linear) | **Add — see §3.4** |
| Configurable forms per type | **Missing** | ✅ | ✅ (Jira screens) | **Add — see §3.5** |
| Relations: blocks/duplicates/relates/parent/child/precedes/follows | Partial (`WorkPackageRelation` model exists) | ✅ | ✅ | **Add full type set** |
| Backlogs (product + sprint + burndown) | Partial (`Sprint`, `SprintMember`, `BurndownData` models exist) | ✅ | ✅ (Jira) | **Wire up UI + burndown chart** |
| AI suggest assignee/duration | **Missing** | ❌ | ⚠️ (Linear, Notion AI) | **Add — see §19.1** |
| Recurring work packages | **Missing** | ❌ | ✅ (Asana, ClickUp) | **Add — see §19.13** |
| Cloning with children | **Missing** | ✅ | ✅ | Add — WP detail menu |
| Move to other project | Implemented (per API) | ✅ | ✅ | Keep + add dialog with field remap |
| Time tracking entries on WP | Implemented (`TimeEntry`) | ✅ | ✅ | Keep |

### 2.2 Projects

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Create/edit/archive | Implemented | ✅ | ✅ | Keep |
| Project hierarchy (subprojects) | **Missing** (no `parentId` on `Project`) | ✅ | ✅ (Asana) | **Add — see §6** |
| Inherited members | **Missing** | ✅ | ✅ | Add — via group membership + project group |
| Inherited custom fields | **Missing** | ✅ | ⚠️ | Add — project-level CF enablement |
| Inherited modules | Partial (`ProjectModule`) | ✅ | ✅ | Keep + default-on settings per type |
| Project templates | Implemented (`ProjectTemplate`) | ✅ | ✅ | Keep + marketplace |
| Copy project | Implemented | ✅ | ✅ | Keep + per-section selector |
| Project archive | **Missing** | ✅ | ✅ | **Add — see §6.3** |
| Identifier (URL slug) | Implemented | ✅ | ✅ | Keep |
| Public sharing (read-only link) | **Missing** | ❌ | ✅ (Notion) | **Add — see §19.10** |
| Activity feed | Implemented | ✅ | ✅ | Keep |
| Storage quota | **Missing** | ⚠️ | ✅ | Add — S3 tier based |

### 2.3 Members, Roles, Permissions

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Per-project role | Implemented (`Member`, `Role`) | ✅ | ✅ | Keep |
| Built-in roles | Implemented | ✅ | ✅ | Keep + add `Reader`, `Guest+`, `Project Manager` |
| Fine-grained permissions | Partial (boolean on `Role`) | ✅ | ✅ (Jira schemes) | **Extend to typed perms — see §21** |
| Group membership | Implemented (`Group`, `GroupMembership`) | ✅ | ✅ | Keep |
| LDAP sync | Implemented (`LdapServer`, `LdapGroupMapping`) | ✅ | ⚠️ | Keep + add onelogin/Okta sync |
| SCIM provisioning | **Missing** | ✅ | ✅ | **Add — see §7.5** |
| Placeholder users | **Missing** | ✅ | ⚠️ | **Add — see §7.4** |
| OAuth providers | Implemented | ✅ | ✅ | Keep + add SAML |
| 2FA / WebAuthn | Implemented (`WebAuthnCredential`) | ⚠️ | ✅ | Keep + add TOTP fallback |
| User invitation | Implemented | ✅ | ✅ | Keep + add bulk invite |
| Profile pages | Implemented | ✅ | ✅ | Keep + add skills/endorsements |

### 2.4 Boards

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Kanban board | Implemented | ✅ | ✅ | Keep |
| Column by status | Implemented | ✅ | ✅ | Keep |
| Column by assignee | **Missing** | ✅ | ✅ | **Add — see §4.2** |
| Column by version | **Missing** | ✅ | ✅ | Add |
| Column by subproject | **Missing** | ⚠️ | ✅ | Add |
| Swimlanes (group rows) | **Missing** | ✅ | ✅ | **Add — see §4.5** |
| WIP limits per column | Partial (`ProjectWipLimit`) | ✅ | ✅ | Keep + visual warning |
| Card filtering | Implemented | ✅ | ✅ | Keep + per-board saved filters |
| Card colour by priority | **Missing** | ✅ | ✅ | Add |
| Card cover image | **Missing** | ❌ | ✅ (Trello) | Optional |
| Card checklist | **Missing** | ❌ | ✅ | **Add — see §19.13** |
| Agile board with sprints | Partial (`Sprint` model) | ✅ | ✅ (Jira) | **Wire up UI — see §3.10, §4.3** |
| Drag to reorder | Implemented | ✅ | ✅ | Keep |
| Drag to move card across columns | Implemented | ✅ | ✅ | Keep |
| Auto-add rule (subscriber rule) | **Missing** | ✅ | ✅ | Add |

### 2.5 Gantt

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Gantt view | Implemented | ✅ | ✅ | Keep |
| Drag-to-move bar | **Missing** | ✅ | ✅ | **Add — see §5.4** |
| Drag-to-resize bar (duration) | **Missing** | ✅ | ✅ | **Add — see §5.4** |
| Dependencies (FS only) | **Missing** | ✅ | ✅ | **Add full type — see §5.1** |
| Critical path | **Missing** | ✅ | ✅ (MS Project) | **Add — see §5.2** |
| Baseline tracking | **Missing** | ✅ | ⚠️ | **Add — see §5.3** |
| Resource histogram | **Missing** | ✅ | ✅ | **Add — see §5.5** |
| Zoom levels (day/week/month/quarter) | Implemented | ✅ | ✅ | Keep |
| Export to PDF/PNG | Implemented (XLSX export) | ✅ | ✅ | Keep + add PDF |
| Auto-schedule | **Missing** | ⚠️ | ✅ (ClickUp) | Optional |

### 2.6 Calendar

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Month view | Implemented | ✅ | ✅ | Keep |
| Week view | **Missing** | ✅ | ✅ | **Add** |
| Day view | **Missing** | ✅ | ✅ | **Add** |
| Agenda view | **Missing** | ✅ | ✅ | **Add** |
| Filter by project/type/assignee | Partial | ✅ | ✅ | **Extend to per-user** |
| iCal feed | **Missing** | ✅ | ✅ | **Add — see §15.3** |
| Calendar sync (Google/Outlook) | **Missing** | ❌ | ✅ | **Add — see §19.6** |

### 2.7 Wiki

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Markdown | Implemented (`WikiPage`) | ⚠️ | ✅ | Keep |
| WYSIWYG editor | **Missing** | ✅ | ✅ | **Add — see §12.2** |
| Page hierarchy | **Missing** | ✅ | ✅ | **Add — see §12.3** |
| Macros | Implemented | ✅ | ✅ | Keep + new macros |
| Page history | Implemented (`WikiPageVersion`) | ✅ | ✅ | Keep + diff view |
| Export to PDF | **Missing** | ✅ | ✅ | **Add — see §12.6** |
| Inline comments | **Missing** | ⚠️ | ✅ (Notion) | Optional |

### 2.8 Forums

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Forums per project | Implemented (`Forum`, `ForumThread`, `ForumPost`) | ✅ | ❌ | Keep |
| Categories | **Missing** | ✅ | ❌ | **Add — see §11.1** |
| Sticky threads | **Missing** | ✅ | ❌ | **Add — see §11.2** |
| Polls | **Missing** | ❌ | ❌ | **Add — see §11.3** |
| Moderation (lock, delete) | **Missing** | ✅ | ❌ | **Add — see §11.4** |
| Reactions | **Missing** | ❌ | ❌ | Add (👍 ❤️ 🎉 👀) |
| Mentions | **Missing** | ✅ | ✅ | Add |

### 2.9 Documents

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| File storage | Implemented (`Document`, `ProjectFile`) | ✅ | ✅ | Keep + add S3 backend |
| Version control | Implemented (`DocumentVersion`) | ✅ | ⚠️ | Keep + diff for text files |
| Folder hierarchy | Implemented (`DocumentFolder`) | ✅ | ✅ | Keep |
| Permissions per document | **Missing** | ✅ | ✅ | **Add — see §13.4** |
| WebDAV access | **Missing** | ✅ | ⚠️ | Optional |
| Virus scan hook | **Missing** | ⚠️ | ✅ | Add (ClamAV or provider API) |

### 2.10 News

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Project-scoped news | Implemented (`News`, `NewsComment`) | ✅ | ❌ | Keep |
| Global news | Implemented (`Announcement`) | ✅ | ❌ | Keep + cross-publish |
| Comments | Implemented | ✅ | ❌ | Keep + reactions |
| RSS feed | **Missing** | ✅ | ❌ | Add |

### 2.11 Meetings

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Meeting per project | Implemented (`Meeting`, `MeetingAttendee`) | ✅ | ⚠️ | Keep |
| Agenda | Implemented (`MeetingAgendaItem`) | ✅ | ⚠️ | Keep + drag reorder |
| Minutes | Implemented (`MeetingMinutes`) | ✅ | ⚠️ | Keep + diff between meetings |
| Time slot reservations | **Missing** | ✅ | ✅ (Calendly) | **Add — see §10.2** |
| Action items as WP | **Missing** | ✅ | ⚠️ | **Add — see §10.3** |
| Recurring meeting series | **Missing** | ⚠️ | ✅ | **Add — see §10.4** |
| Video call link (Zoom/Meet) | **Missing** | ❌ | ✅ | **Add — see §19.8** |

### 2.12 Activity Feed & Notifications

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| In-app bell | Implemented (`Notification`) | ✅ | ✅ | Keep |
| Notification center | Implemented | ✅ | ✅ | Keep |
| Per-event subscription | Partial (`NotificationSetting`) | ✅ | ✅ | **Extend granularity — see §16.4** |
| Email notifications | Implemented (`EmailQueue`) | ✅ | ✅ | Keep + digest mode |
| Push (web push) | **Missing** | ❌ | ✅ | **Add — see §16.3** |
| Mobile push (FCM/APNs) | **Missing** | ❌ | ✅ | Add with PWA |
| @mentions | **Missing** | ✅ | ✅ | Add |

### 2.13 Time Tracking

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Time entries on WP | Implemented (`TimeEntry`) | ✅ | ✅ | Keep |
| Time bookings calendar | **Missing** | ✅ | ✅ (Toggl, Clockify) | **Add — see §8.2** |
| Approval workflow | **Missing** | ✅ | ✅ | **Add — see §8.3** |
| Reports by user/project/activity | Partial | ✅ | ✅ | **Extend — see §8.4** |
| Hourly rates | **Missing** | ✅ | ✅ | **Add — see §8.5** |
| Budget integration | Implemented (`Budget`, `BudgetLine`) | ✅ | ✅ | Keep + forecast vs actual |

### 2.14 Budgets

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Per project | Implemented | ✅ | ✅ | Keep |
| Per WP | **Missing** | ✅ | ⚠️ | **Add — see §9.2** |
| Labor + unit + material cost | Partial | ✅ | ✅ | **Extend — see §9.3** |
| Forecast vs actual | **Missing** | ✅ | ✅ | **Add — see §9.4** |
| Budget alert at threshold | **Missing** | ⚠️ | ✅ | Add |

### 2.15 Search

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Global search | Implemented (`pages/api/search`) | ✅ | ✅ | Keep + ranking |
| Filters | Implemented | ✅ | ✅ | Keep |
| Saved searches | Implemented (`SavedQuery`, `Query`) | ✅ | ✅ | Keep + shareable |
| Sort | Implemented | ✅ | ✅ | Keep |
| Cross-project search | Partial | ✅ | ✅ | Extend |
| Fuzzy search | **Missing** | ⚠️ | ✅ | Add (pg_trgm or Meili) |
| Jump-to (command palette) | **Missing** | ⚠️ | ✅ (Linear, Notion) | **Add — see §17.4** |

### 2.16 Reports

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Burndown | Partial (`BurndownData` model) | ✅ | ✅ | **Wire up chart — see §18.1** |
| Velocity | **Missing** | ✅ | ✅ | **Add — see §18.2** |
| Time spent | Partial (`time-reports` API) | ✅ | ✅ | Extend with charts |
| Custom reports | **Missing** | ⚠️ | ✅ (Jira) | **Add — see §18.4** |
| Cross-project rollup | **Missing** | ✅ | ✅ | Add |

### 2.17 Webhooks & API

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| API v3 | Implemented (`pages/api/v3`) | ✅ | ✅ | Keep + OpenAPI doc |
| Webhooks | Implemented (`Webhook`, `WebhookDelivery`) | ✅ | ✅ | Keep + per-event filter |
| Webhook retries with backoff | **Missing** | ✅ | ✅ | **Add — see §23.5** |
| Webhook signing | **Missing** | ✅ | ✅ | **Add HMAC** |
| Rate limiting | Partial | ✅ | ✅ | Extend + per-key quotas |

### 2.18 System

| Aspect | Status today | Original | Modern | Action |
|---|---|---|---|---|
| Branding (logo, colours) | Implemented (`Branding`) | ✅ | ✅ | Keep + dark-mode toggle |
| Announcements | Implemented | ✅ | ✅ | Keep |
| Help pages | Implemented (`pages/help`) | ✅ | ✅ | Keep + context help |
| Global dashboard | Implemented (`pages/dashboard`) | ✅ | ✅ | Keep + widgets |
| My page | Implemented (`pages/my-page`) | ✅ | ✅ | Keep + widget library |
| Recent projects | Implemented | ✅ | ✅ | Keep |
| Repository (Git) | Implemented (`Repository`, `Commit`, `CommitWorkPackage`) | ✅ | ⚠️ | Keep + deep link commit→WP |
| CSV/PDF/XLSX export | Implemented (`pages/api/exports`) | ✅ | ✅ | Keep |
| Keyboard shortcuts | Implemented | ✅ | ✅ (Linear) | Keep + discoverable (⌘K) |
| Mobile responsive | Implemented (Tailwind) | ⚠️ | ✅ | **PWA upgrade — see §19.2** |
| Offline mode | **Missing** | ❌ | ✅ | **Add — see §19.3** |
| Internationalisation | Implemented | ✅ | ✅ | Keep + RTL audit |
| Accessibility (WCAG 2.2 AA) | Partial (Radix UI) | ✅ | ✅ | Audit + axe-core CI gate |
| Audit log | **Missing** | ✅ | ✅ | Add |

### 2.19 Integration gaps (the original OpenProject has more than us in some places)

| Original OP feature | Rewrite status | Priority |
|---|---|---|
| Backlogs (Agile) | Models only, no UI | **High** |
| Work Package workflows | Missing | **High** |
| Configurable forms | Missing | **High** |
| Subprojects | Missing | **High** |
| Categories & severities | Missing | Medium |
| Recurring meetings | Missing | Medium |
| Meeting time slots | Missing | Medium |
| Placeholder users | Missing | Medium |
| SCIM | Missing | Medium |
| Custom reports | Missing | Medium |
| Risk register | Missing | Low |
| Storages (Nextcloud/OneDrive) | Missing | Low |
| Two-factor backup codes | Missing | Low |

---

## 3. Work Packages Overhaul

### 3.1 Goals

1. Make a work package the **single source of truth** for any unit of work (task, bug, feature, risk, milestone, decision, change request).
2. Make every visible field, button, transition, and notification configurable per **type** and per **role**.
3. Surface inline activity (comments, time logs, status changes, file uploads, custom field edits) in a chronological stream.
4. Make relations first-class citizens with graph visualisation.
5. Make backlogs (product + sprint) and burndown work out of the box.

### 3.2 Data model additions

The existing `WorkPackage` model is rich. Additions and refactors required:

```
model WorkPackageCategory {
  id          String   @id @default(cuid())
  projectId   String
  name        String
  assignedToId String?
  createdAt   DateTime @default(now())
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  workPackages WorkPackage[] @relation("CategoryToWorkPackage")
  @@unique([projectId, name])
}

model Severity {
  id        String   @id @default(cuid())
  name      String   @unique
  position  Int
  color     String
  isDefault Boolean  @default(false)
}

model Workflow {
  id              String   @id @default(cuid())
  typeId          String
  roleId          String
  oldStatusId     String
  newStatusId     String
  authorizable    Boolean  @default(true)   // can user perform this transition?
  notifyAuthor    Boolean  @default(true)
  assigneeOnly    Boolean  @default(false)  // only current assignee can move
  type            Type     @relation(fields: [typeId], references: [id], onDelete: Cascade)
  role            Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  oldStatus       Status   @relation("WorkflowOld", fields: [oldStatusId], references: [id], onDelete: Cascade)
  newStatus       Status   @relation("WorkflowNew", fields: [newStatusId], references: [id], onDelete: Cascade)
  @@unique([typeId, roleId, oldStatusId, newStatusId])
}

model TypeForm {
  id        String   @id @default(cuid())
  typeId    String
  active    Boolean  @default(true)
  isDefault Boolean  @default(false)
  type      Type     @relation(fields: [typeId], references: [id], onDelete: Cascade)
  sections  TypeFormSection[]
}

model TypeFormSection {
  id        String   @id @default(cuid())
  formId    String
  position  Int
  label     String
  form      TypeForm @relation(fields: [formId], references: [id], onDelete: Cascade)
  fields    TypeFormField[]
}

model TypeFormField {
  id          String   @id @default(cuid())
  sectionId   String
  position    Int
  fieldKey    String   // "subject", "description", "assignee", "customField:42"
  required    Boolean  @default(false)
  hidden      Boolean  @default(false)
  readonly    Boolean  @default(false)
  defaultValue Json?
  section     TypeFormSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
}

model WorkPackageRelation {
  id            String   @id @default(cuid())
  fromId        String
  toId          String
  type          RelationType
  lag           Int      @default(0)        // in hours, for Gantt scheduling
  createdAt     DateTime @default(now())
  from          WorkPackage @relation("RelationFrom", fields: [fromId], references: [id], onDelete: Cascade)
  to            WorkPackage @relation("RelationTo",   fields: [toId],   references: [id], onDelete: Cascade)
  @@unique([fromId, toId, type])
  @@index([toId])
}

enum RelationType {
  RELATES
  DUPLICATES
  DUPLICATED
  BLOCKS
  BLOCKED
  PRECEDES
  FOLLOWS
  PARENT
  CHILD
  INCLUDES
  INCLUDED
  REQUIRES
  REQUIRED
}

model WorkPackageWatcher {
  workPackageId String
  userId        String
  createdAt     DateTime @default(now())
  workPackage   WorkPackage @relation(fields: [workPackageId], references: [id], onDelete: Cascade)
  user          User        @relation(fields: [userId],        references: [id], onDelete: Cascade)
  @@id([workPackageId, userId])
}

model RecurringWorkPackage {
  id            String   @id @default(cuid())
  templateId    String
  interval      RecurInterval
  every         Int       @default(1)    // every N days/weeks/months
  weeklyOn      Int[]                  // [1,3,5] for Mon, Wed, Fri
  startOn       DateTime
  endOn         DateTime?
  nextRunOn     DateTime
  template      WorkPackage @relation(fields: [templateId], references: [id], onDelete: Cascade)
}

enum RecurInterval {
  DAILY
  WEEKLY
  MONTHLY
  YEARLY
  CRON
}
```

### 3.3 Work package detail page

The work package detail page is split into four logical panes:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Back  [#1234] Implement OAuth2 PKCE flow     [⏱ 4h logged] [⋯]   │
├───────────────────────────────────────────┬──────────────────────────┤
│ Subject *                                 │ Type   : Feature        │
│ Description (markdown)                    │ Status : In progress    │
│                                           │ Priority: High          │
│ ── Details ─────────────────────────────  │ Assignee: @alice        │
│ Project       : Acme › Billing            │ Responsible: @bob       │
│ Version       : v1.2                      │ Start    : 2026-06-08   │
│ Category      : API                       │ Due      : 2026-06-15   │
│ Severity      : Major                     │ % done  : 60            │
│ Estimated     : 16h                        │ Spent    : 9.5h         │
│ Custom field 1: "Customer"  ACME          │ Watchers: 3             │
│ Custom field 2: "SLA"       Gold           │                        │
│                                           │                        │
│ ── Relations ──────────────────────────── │  ┌─Activity──────────┐ │
│ • Blocks  #1240 Deploy to staging          │  │ @alice commented…  │ │
│ • Parent  #1100 Q2 Roadmap                 │  │ @bob  logged 2h    │ │
│ • Children 2                              │  │ Status: New→Doing  │ │
│                                           │  │ [📎 spec.pdf]      │ │
│ ── Children (2) ────────────────────────  │  │ [💬 Reply…]        │ │
│ • #1235  Write tests                       │  └────────────────────┘ │
│ • #1236  Update docs                       │                         │
└───────────────────────────────────────────┴──────────────────────────┘
```

Behaviour:

- **Left column** is the data form; it is **rendered from the `TypeForm` config** (see §3.5). Hidden fields are not shown. Read-only fields show as text. Required fields have a red asterisk.
- **Right column** is the activity stream (§3.8).
- **Subject** is always the first inline-editable field.
- The top breadcrumb links up the project hierarchy.
- The action menu `[⋯]` exposes: copy link, duplicate, move to project, convert to other type, create child, add watcher, export PDF, delete, add to sprint.
- `⏱ Nh logged` opens the inline time log popover (see §8.1).

### 3.4 Workflows (state machines)

#### 3.4.1 Concept

A **Workflow** is a quadruple `(type, role, fromStatus, toStatus)` indicating that a user with that role is allowed to transition a work package of that type from `fromStatus` to `toStatus`. This is identical to the original OpenProject model but stored as a normalised table rather than a YAML file so the admin UI can edit it.

#### 3.4.2 Editor

Admins open `Admin → Workflows`. A matrix is displayed:

```
                  Reporter  Contributor  Manager  Admin
Type: Task
  New → In progress       ☑          ☑        ☑     ☑
  In progress → Closed     ☐          ☑        ☑     ☑
  In progress → Reopened   ☐          ☑        ☑     ☑
  Closed  → Reopened       ☐          ☐        ☑     ☑
```

Clicking a cell toggles the transition. The matrix supports bulk operations ("copy workflows from Task to Bug with role override"). Per-transition options:

- `notifyAuthor` — when the transition happens, send a notification to the original author.
- `assigneeOnly` — restrict the transition to the currently assigned user (useful for "claim work").
- `requireComment` — force the user to enter a note explaining the transition.
- `requireAttachment` — force the user to attach a file.

#### 3.4.3 Default workflows

A migration seeds a sensible default workflow identical to original OpenProject:

| From | To | Reporter | Contributor | Manager | Admin |
|---|---|---|---|---|---|
| New | In progress | ☑ | ☑ | ☑ | ☑ |
| In progress | Resolved / Closed | ☐ | ☑ | ☑ | ☑ |
| Resolved | Reopened / In progress | ☑ | ☑ | ☑ | ☑ |
| Resolved | Closed | ☐ | ☑ | ☑ | ☑ |
| Closed | Reopened | ☐ | ☐ | ☑ | ☑ |

#### 3.4.4 Execution

When a user clicks the **Status** field on the work package form, the dropdown lists only statuses that have at least one outgoing workflow for the user's roles in the project for the WP's type. Selecting a status fires:

1. **Permission check** — is there a workflow `(type=Task, role=Contributor, from=In progress, to=Closed)`? If no, return `403 Forbidden`.
2. **Pre-transition hook** — any **transition hook** (defined in §19.12) runs. If it throws, the transition aborts.
3. **Post-transition hook** — runs after the database write. Hooks can update other fields (e.g., "when status → Done, set % complete = 100").
4. **Activity log entry** — created automatically with old/new status and timestamp.
5. **Notification fan-out** — watchers + assignee + responsible are notified per their subscription settings (see §16).

### 3.5 Configurable forms per type

#### 3.5.1 Concept

Each **Type** has one or more **TypeForm** records. Each form has ordered **Sections** (e.g., "Details", "Custom fields", "Planning") and each section has ordered **Fields** identified by `fieldKey`.

`fieldKey` is a stable string with one of these shapes:

- Built-in field: `subject`, `description`, `assignee`, `responsible`, `startDate`, `dueDate`, `estimatedTime`, `spentTime`, `percentageDone`, `status`, `priority`, `type`, `version`, `parent`, `category`, `severity`, `watchers`, `files`.
- Custom field: `customField:<id>`.
- Relations block: `relations` (renders the relations list inside the form).

#### 3.5.2 UI

`Admin → Forms` lists all types. Selecting a type opens the form editor with three columns:

- **Palette** (left): a searchable list of all available field keys.
- **Canvas** (middle): the current form layout with sections (draggable rows).
- **Inspector** (right): properties of the currently selected field — required, hidden, readonly, default value, help text, conditional visibility.

#### 3.5.3 Conditional visibility

Each field can be conditionally shown based on a JSON expression evaluated against the current work package state:

```json
{ "and": [
    { "field": "status", "op": "in", "value": ["In progress", "Review"] },
    { "field": "assignee", "op": "is_set" }
] }
```

Supported operators: `eq`, `neq`, `in`, `not_in`, `is_set`, `is_unset`, `gt`, `gte`, `lt`, `lte`, `contains`, `starts_with`, `matches_regex`, `has_role`, `today_is_before`. This makes forms expressive enough to model a "Hide estimated time when status = New" rule.

#### 3.5.4 Multiple forms per type

A type can have multiple forms (e.g., "Create" vs "Edit" vs "Bulk create"). When a WP is opened in edit mode, the first matching form is used. Conditions for selection are evaluated in `isDefault` order.

### 3.6 Relations

#### 3.6.1 Relation types

The full set defined in `RelationType` enum above. Visually we render:

| Type | Arrow on graph | Visual hint |
|---|---|---|
| RELATES | dotted line | grey |
| DUPLICATES / DUPLICATED | solid line with "≡" | blue |
| BLOCKS / BLOCKED | solid arrow | red |
| PRECEDES / FOLLOWS | solid arrow with "→" | orange (Gantt) |
| PARENT / CHILD | hierarchical | indented tree |
| INCLUDES / INCLUDED | solid line | green |
| REQUIRES / REQUIRED | solid arrow | purple |

#### 3.6.2 Behavioural semantics

- **PARENT** is mutually exclusive with another PARENT (a WP has at most one parent). The child's `% done` and `estimatedTime` are rollups of children unless overridden.
- **DUPLICATED** automatically creates a **DUPLICATES** in the opposite direction.
- **BLOCKS** is meaningful in Gantt — the blocked WP cannot start before the blocking WP is done. Critical path uses BLOCKS/PRECEDES.
- **PRECEDES/FOLLOWS** have a `lag` (positive or negative hours) and inform auto-scheduling.
- **REQUIRES** is symmetric — if A REQUIRES B, removing B without unlinking raises a warning.

#### 3.6.3 Inline relation creation

On the work package form, the user types `#1234` in any text field. A popover suggests existing work packages. Selecting one opens "Add relation: [this] RELATES #1234?". The relation is added without a modal.

#### 3.6.4 Relation graph view

A new page `/projects/:id/relations` renders a **force-directed graph** (using `d3-force` or `react-flow`) of all WPs and their relations. Users can drag nodes, double-click to navigate, and filter by relation type. Useful for impact analysis and refactor planning.

### 3.7 Watchers

A `WorkPackageWatcher` is a many-to-many join between work packages and users. Default watchers on creation:

- The author
- The assignee (if set)
- The responsible (if set)

Admins can configure per type: `autoWatch: "author" | "assignee" | "responsible" | "none"`.

The **Watch** button on the work package is a toggle. The **Watchers** side panel lists all watchers; the responsible user can be promoted to watcher automatically.

Bulk-watch is supported: select N WPs in a table → right-click → "Watch all" / "Unwatch all".

### 3.8 Activity stream

Each work package has an `Activity` timeline. Activities are append-only and grouped by day. Each activity entry has:

- `id`
- `journalId` — points to the **journal** that triggered the activity (so we can show a diff)
- `kind` — comment | system | time_entry | status_change | attachment | custom_field_change | relation_added | watcher_added | spent_time | percent_done
- `actorId`
- `createdAt`
- `payload` — JSON with the change details

#### 3.8.1 Comments

Comments are rich-text (markdown + @mentions). Mentioning a user (e.g., `@alice`) creates a notification and offers autocomplete based on project members. Mentions are anchored so re-rendering a name change updates the link.

#### 3.8.2 Inline replies

A comment can have threaded replies. The model is:

```
ActivityComment
  id
  activityId
  parentId   // null = root
  authorId
  body       // markdown
  reactions  // [{ emoji, userId }]
  editedAt
  deletedAt  // soft delete
```

Reactions use an emoji set: 👍 ❤️ 🎉 👀 🚀 😂 ❓. The emoji count is shown next to each.

#### 3.8.3 System activity

System events (`status changed`, `assignee set`, `custom field X changed from A to B`) are read-only and rendered with a distinct icon. Hovering shows a diff popover (old value → new value).

#### 3.8.4 Log time inline

Within the activity composer, a `⏱ Log time` button opens a popover with: hours, date (default today), activity (e.g., "Development", "Management"), billable, comment. On save, a `TimeEntry` is created and an activity entry is added.

### 3.9 Categories, versions, priorities, severities

#### 3.9.1 Categories

- Model: `WorkPackageCategory` (added above).
- Per project, ordered list with optional assignee (a default user for unassigned WPs in that category).
- UI: project settings → categories.

#### 3.9.2 Versions

Already exist (`Version` model). Add:

- `Version.burndown` view (links to `BurndownData`).
- `Version.remainingWork` cached aggregate.
- `Version.completedAt` auto-set when last WP reaches a "closed" status.

#### 3.9.3 Priorities

Already exist. Add:

- Visual icons per priority.
- Per-priority colour used across table, board, Gantt.
- Sortable list in admin.

#### 3.9.4 Severities

- Model: `Severity` (added above).
- Used for bug tracking (e.g., "S1 blocker", "S2 critical", "S3 major", "S4 minor").
- Configurable globally; admins can add/remove.

### 3.10 Backlogs (Agile)

#### 3.10.1 Concepts

A **Sprint** is a `Version` with a `startDate` and `endDate`. A **product backlog** is the sum of all WPs in a project that are not in any active sprint. The **sprint backlog** is the set of WPs assigned to that sprint. **Burndown** is the daily sum of remaining estimated time (or remaining story points) per sprint.

#### 3.10.2 Existing models (already in schema)

- `Sprint`, `SprintMember`, `BurndownData` — already in `prisma/schema.prisma`. Wire to UI.

#### 3.10.3 Pages

- `/projects/:id/backlogs` — three-pane layout:
  - **Left (narrow)**: list of sprints + "Product backlog".
  - **Centre**: story list (drag from left or right).
  - **Right**: detail of the selected story (read-only summary + open in full screen).
- `Add story` button opens a quick-create form (Task or User story).

#### 3.10.4 Burndown

Computed nightly and on every WP change:

```
burndown[t] = sum(estimatedTime of WPs in sprint with status not closed) at time t
ideal[t]    = totalEstimatedTime * (1 - t / sprintLengthDays)
```

A line chart overlays actual vs ideal. If actual > ideal for two consecutive days, a warning badge appears on the sprint card.

#### 3.10.5 Sprint lifecycle

States: `planned → active → completed`. A planner drags WPs into a planned sprint, then activates it on its start date. WPs in an active sprint can be edited; new WPs cannot be added directly — they go to the product backlog and require explicit promotion.

#### 3.10.6 Velocity

After a sprint is completed, `velocity = sum(storyPoints of completed WPs)`. Velocity is shown on a rolling 5-sprint chart and used to forecast future sprint capacity (see §18.2).

### 3.11 AI assist on work packages

See §19.1. Briefly, an AI assist button is shown in the composer suggesting:
- Best assignee (based on past WPs of similar type and current workload).
- Predicted duration (based on similar past WPs).
- Suggested parent/relations.
- Auto-summary of long comment threads.

---

## 4. Boards Overhaul

### 4.1 Goals

1. Multiple board types in one project: status board, assignee board, version board, subproject board, free-form board.
2. WIP limits enforced visually (warning) and optionally strictly (block drag).
3. Swimlanes for additional grouping (priority, type, epic, custom field).
4. Card-level actions inline: open, edit, watch, log time, add relation.
5. Saved filters per board that all members see.
6. Sprint board view (see §3.10) integrated with the board.

### 4.2 Column types

When creating a board, the user picks the **column strategy**:

| Strategy | Column dimension | Default values |
|---|---|---|
| Status | Status model | All statuses used by type |
| Assignee | User (project members) | One column per assignee + "Unassigned" |
| Version | Version model | All versions + "Backlog" + "Unversioned" |
| Subproject | Project (children only) | All subprojects + "Parent project" |
| Type | Type | All types in project |
| Custom field | Any custom field of type list | All values |
| Free-form | Manual | User creates columns and assigns WPs |

### 4.3 Sprint / Agile boards

A board can be **linked to a sprint** (a Version with dates). The board then shows:
- Header with sprint name, dates, progress, "Complete sprint" button.
- Columns as status.
- A summary row at the top: total WPs, total estimated time, total spent time.
- A "Sprint goal" text field (markdown).
- Auto-rollup of the burndown chart in a side panel.

Multiple sprints can be displayed in stacked swimlanes ("Sprint 1 / Sprint 2 / Backlog").

### 4.4 WIP limits

Already partially implemented (`ProjectWipLimit` model). Extend:

- Per board, per column: a numeric limit with soft/hard enforcement.
- **Soft**: a column exceeding its limit is shown in red with a warning icon. Dragging in is still allowed.
- **Hard**: dragging in is blocked and a toast appears: "Column is at WIP limit (5). Either complete a card or raise the limit."
- Auto-suggested limit based on rolling throughput (configurable: e.g., "Suggest limit = 80th percentile of last 30 days of completed WPs").

### 4.5 Swimlanes

A board can define **swimlanes** — horizontal rows that group cards. Options:

- **Priority** — rows = priorities ordered by `position`.
- **Type** — rows = types.
- **Epic** — rows = epics (WPs with `type = Epic`).
- **Assignee** — rows = users.
- **Custom field** — rows = values of a chosen list CF.
- **No swimlanes** (default).

Cards without a swimlane value fall into an "Uncategorised" row at the top.

### 4.6 Card UI

```
┌──────────────────────────────────┐
│ #1234  Implement OAuth PKCE      │  [color stripe = priority]
│ ────                            │
│ [Type badge] [Status badge]      │
│                                  │
│ 16h est · 9h spent   👤 @alice   │
│ ⏱ 4d   🔴 Blocker   💬 3        │
└──────────────────────────────────┘
```

Card details shown (per `Board.cardConfig`):
- Subject (truncated, 80 chars).
- WP ID for quick reference.
- Type badge.
- Status badge.
- Priority indicator.
- Assignee avatar.
- Estimated time + spent time.
- Due date.
- Severity icon (if bug).
- Comment count.
- Watcher count.
- File attachment count.

The card is a single click to open the inline edit drawer; `Esc` closes.

### 4.7 Inline actions on a card

- **Edit subject** (inline F2 or click).
- **Log time** (icon → popover).
- **Add comment** (icon → quick composer).
- **Add watcher** (icon → member picker).
- **Add relation** (icon → relation picker).
- **Change status** (icon → status picker filtered by workflow).
- **Move to other column** (drag handle).
- **Open** (double-click → detail view).

### 4.8 Saved filters

Each board can be filtered by:
- Type (multi-select).
- Priority (multi-select).
- Assignee (multi-select).
- Custom fields.
- Date ranges (start, due, created, updated).
- Text search (subject/description).
- Has / has not relations.

Filters are saved per board and shared with all viewers. A "Filters visible" toggle in the board header reveals them.

### 4.9 Performance

At 10k WPs per project, the board must not re-render the world on a drag. Implementation notes:

- Virtualised columns (only the visible WPs are rendered).
- Cards are memoised; the dnd context only re-renders the source and target columns.
- Server-side filtering with a stable `?filter=...` URL; the server returns the WP IDs and minimal card data (no descriptions).
- Optimistic UI: drag-and-drop fires a PATCH immediately; on failure, the card snaps back with a toast.

---

## 5. Gantt Overhaul

### 5.1 Dependencies

The existing `WorkPackageRelation` model already supports a `type` field. Map to the four Gantt types:

| Gantt type | Relation | Direction | Default lag |
|---|---|---|---|
| Finish-to-Start (FS) | A FOLLOWS B (B precedes A) | B end → A start | 0 |
| Start-to-Start (SS) | new `type` `STARTS_WITH` | B start → A start | 0 |
| Finish-to-Finish (FF) | new `type` `ENDS_WITH` | B end → A end | 0 |
| Start-to-Finish (SF) | new `type` `ENDS_WITH_START` | B start → A end | 0 |

Add to the enum:
```
enum RelationType {
  ... existing ...
  STARTS_WITH
  STARTS_WITH_START
  ENDS_WITH
  ENDS_WITH_START
}
```

Each relation stores `lag` (hours, can be negative for lead time).

### 5.2 Critical path

The critical path is the longest chain of dependent tasks (sum of duration + lag). Implementation:

1. Build a DAG from all WPs and their PREDECESSOR relations.
2. Detect cycles and warn the user (a cycle cannot be scheduled).
3. Compute earliest start (ES), earliest finish (EF), latest start (LS), latest finish (LF) using the standard forward/backward pass with the four dependency types and lags.
4. WPs where `ES == LS` and `EF == LF` are on the critical path.
5. Render critical-path WPs in red; non-critical in grey.
6. Show "slack" (LS - ES) on hover for non-critical WPs.

The critical path is recomputed on every relevant change (debounced 500ms).

### 5.3 Baseline tracking

Each project can save a **baseline** — a snapshot of all WP start/dates/percent-done at a point in time. Add:

```
model ProjectBaseline {
  id        String   @id @default(cuid())
  projectId String
  name      String
  takenAt   DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  snapshots BaselineSnapshot[]
}

model BaselineSnapshot {
  id          String   @id @default(cuid())
  baselineId  String
  workPackageId String
  startDate   DateTime?
  dueDate     DateTime?
  estimatedHours Float
  spentHours  Float
  baseline    ProjectBaseline @relation(fields: [baselineId], references: [id], onDelete: Cascade)
  workPackage WorkPackage @relation(fields: [workPackageId], references: [id], onDelete: Cascade)
  @@unique([baselineId, workPackageId])
}
```

A baseline is captured by `Project → Settings → Baselines → Take baseline`. The Gantt then renders **two bars per WP**: baseline (hollow, grey) and current (solid, coloured). Variance is shown as a label `Δ +3d` next to the bar.

### 5.4 Drag-to-resize, drag-to-move

#### 5.4.1 Drag-to-move (horizontal)

- Grab the bar in the middle.
- Drag horizontally; the bar's `startDate` and `dueDate` shift together.
- Snapping to other bars' edges when within 8px.
- Press `Alt` to leave a copy (creates a new WP with the same fields).
- On drop: PATCH the WP; if a workflow transition is required (e.g., "move start date before today requires comment"), the change is staged and a dialog appears.

#### 5.4.2 Drag-to-resize (left/right edges)

- Grab the left edge to move `startDate`.
- Grab the right edge to move `dueDate`.
- Press `Shift` to snap to whole days.
- Display a tooltip with new dates and the resulting duration.

#### 5.4.3 Progress drag

Some Gantt implementations allow dragging the percent-done indicator inside the bar. Optional. We add it as a small handle at the bottom of the bar; dragging sets `% done`.

### 5.5 Resource histogram

The histogram shows the **load per resource (assignee)** over time, computed from all WPs assigned to that user across the project.

```
         W23   W24   W25   W26   W27
@alice   ████  ███   ██    ████  ██
@bob     ██    ████  ███   ██    █
@carol   █     █     ████  ███   ████
───────────────────────────────
Capacity ████  ████  ████  ████  ████
```

- Bar height = estimated hours per day for that resource.
- The line at the bottom is the resource's **capacity** (configurable per user, default 8h/day, 5d/week).
- Bars exceeding capacity turn red.
- Hovering a bar shows the WPs contributing.
- Filter by role, type, or version.

### 5.6 Zoom and time scale

- Day view (1 day = 24px).
- Week view (1 week = 7 × 8px = 56px).
- Month view (1 month = 30 × 4px = 120px).
- Quarter view (1 month = 12px).
- Year view (1 month = 6px).

Custom zoom levels via Ctrl + scroll.

### 5.7 Auto-schedule

Optional, opt-in. Given a set of dependent WPs, the engine propagates dates forward using ES/EF logic. The user can preview the changes ("Preview auto-schedule") before applying. Conflicts (e.g., a WP has a manual startDate that contradicts the schedule) are highlighted in yellow and the user must resolve them or "force apply".

---

## 6. Project Hierarchy

### 6.1 Subprojects

#### 6.1.1 Model change

Add to `Project`:

```
model Project {
  ... existing ...
  parentId   String?
  parent     Project?  @relation("ProjectHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children   Project[] @relation("ProjectHierarchy")
  ...
}
```

#### 6.1.2 Inherited members

If a project has a parent, its **effective members** are:

1. Its own members (with their project-specific role).
2. Members of any ancestor project (with the ancestor's role, unless the member has a more specific role on this project).

Roles do not stack; the most specific wins. Effective permissions are the union of "any role grants X" logic per permission (similar to original OP).

#### 6.1.3 Inherited modules and custom fields

- Modules enabled on a parent are enabled on children (children can opt out per module).
- Custom fields enabled on a parent appear on children's WPs.

#### 6.1.4 UI

- The project page shows a "Parent" breadcrumb and a "Children (3)" tab listing subprojects.
- Creating a project asks "Create as subproject of: [select]".
- The global project list has a tree-view toggle.

### 6.2 Project templates

Already implemented (`ProjectTemplate`). Enhancements:

- Templates are project-aware: a template is a project in `archived` state with `isTemplate = true`.
- Creating from a template copies: members, modules, custom fields, types, statuses, wiki pages, forum categories, document folders, work packages (with relations intact).
- A "Templates marketplace" (§19.11) lets admins share templates across instances.

### 6.3 Project archive

Add to `Project`:

```
archived     Boolean  @default(false)
archivedAt   DateTime?
```

Archived projects are hidden from default lists but accessible via "Show archived" toggle. They cannot be edited, but their data is preserved. An "Unarchive" action requires Manager or Admin.

### 6.4 Project copy with options

The existing copy API (`pages/api/projects/copy`) is extended with a per-section selector:

```
☐ Members (default: yes)
☐ Modules (default: yes)
☐ Custom fields (default: yes)
☐ Types & statuses (default: yes)
☐ Wiki (default: yes, includes all pages)
☐ Forums (default: yes)
☐ Documents (default: yes, without files)
☐ Work packages (default: yes, up to N levels)
☐ Versions (default: yes)
☐ Budgets (default: no)
☐ Settings (default: no)
```

Users also pick the new project's name, identifier, parent, and visibility.

---

## 7. Members, Roles & Identity

### 7.1 Role per project

Implemented. Extend the role model to support **typed permissions** rather than plain booleans:

```
model Permission {
  id        String  @id @default(cuid())
  action    String  // e.g., "work_package.edit"
  roleId    String
  role      Role    @relation(fields: [roleId], references: [id], onDelete: Cascade)
  @@unique([roleId, action])
}
```

This allows the full permission matrix in §21 to be queried efficiently.

### 7.2 Group-based membership

Implemented (`Group`, `GroupMembership`). Extend with:

- Nested groups (a group can contain other groups).
- Group-level roles on projects (a single group assignment grants a role to all current and future members).
- Group watchers (a group can be a watcher; all members receive notifications — opt-out per user).

### 7.3 Built-in roles

| Role | Default capabilities |
|---|---|
| Anonymous | Read public projects only |
| Reader | Read assigned projects, no comments |
| Guest | Read + comment, no WP edit |
| Reporter | + create/edit own WPs, log time |
| Contributor | + edit any WP in project, manage WPs |
| Project Manager | + manage members, modules, settings, reports |
| Admin (system) | All of the above + global settings, branding, webhooks |

### 7.4 Placeholder users

#### 7.4.1 Concept

A **placeholder user** is a `User` record with `isPlaceholder = true` and no real name/email. They represent roles ("Designer", "QA Lead", "On-call engineer") that should be assigned to a WP before the real person is known.

#### 7.4.2 Model addition

```
model User {
  ... existing ...
  isPlaceholder Boolean  @default(false)
  placeholderRole String?  // optional text
}
```

#### 7.4.3 Behaviour

- Placeholders appear in the assignee picker with a distinct icon.
- Notifications sent to a placeholder are queued in `EmailQueue` with `toUser = null` and `placeholderRole = "Designer"`.
- A weekly digest lists all placeholders with a "Replace with real user" link.
- An admin can bulk-replace: "Replace all 'Designer' placeholders with @alice in project X".

### 7.5 LDAP sync (already in place)

Keep. Add:

- Sync on schedule (every 1/6/24 hours) or via webhook from LDAP server.
- Conflict resolution policy: `ldapWins` (default) or `localWins`.
- Attribute mapping UI (e.g., `displayName` → `firstName + lastName`).
- Test connection button.

### 7.6 SCIM provisioning

#### 7.6.1 Concept

SCIM 2.0 is the standard protocol for automated user provisioning from identity providers (Okta, Azure AD, OneLogin, Google Workspace). Implementing SCIM means: when an admin deprovisions a user in the IdP, the user is deactivated in OP within seconds.

#### 7.6.2 Endpoints

- `POST /scim/v2/Users` — create user.
- `GET /scim/v2/Users` — list users.
- `GET /scim/v2/Users/:id` — read user.
- `PUT /scim/v2/Users/:id` — replace user.
- `PATCH /scim/v2/Users/:id` — update user.
- `DELETE /scim/v2/Users/:id` — deactivate user.
- `POST /scim/v2/Groups` — create group.
- Similar for Groups.

Each request is authenticated with a **SCIM bearer token** generated per IdP connection (stored in `LdapServer` row or a new `ScimConnection` model).

#### 7.6.3 Model

```
model ScimConnection {
  id        String   @id @default(cuid())
  name      String
  token     String   @unique  // hashed
  endpoint  String   // exposed URL
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

---

## 8. Time Tracking

### 8.1 Time entries on work packages

Already implemented (`TimeEntry` model). Add:

- **Quick log** widget on the global dashboard: `+ Log 1h on [what I was working on]`.
- **Timer mode**: a "Start timer" button creates an open `TimeEntry` with `startOn = now()`. Stopping the timer sets `hours = (now - startOn)/3600`.
- **Bulk log**: select multiple WPs in a table and apply the same hours/date.
- **Editable after submission** within 24h by the author; afterwards requires Manager approval.

### 8.2 Time bookings calendar

A new page `/my/time/calendar` shows the user's logged time as a calendar overlay (similar to Google Calendar). Each day cell shows total hours, with a breakdown on hover. Click a day to add a `TimeEntry`. Filter by project, WP, activity.

### 8.3 Approval workflow

```
model TimeEntryApproval {
  id          String   @id @default(cuid())
  timeEntryId String
  approverId  String
  status      ApprovalStatus  // PENDING, APPROVED, REJECTED
  comment     String?
  decidedAt   DateTime?
  timeEntry   TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)
}

enum ApprovalStatus { PENDING APPROVED REJECTED }
```

Per project, managers can enable "Approval required". A "Timesheet" page aggregates all pending entries; approvers can approve/reject in bulk with an optional comment.

### 8.4 Reports by user / project / activity

A new page `/reports/time` with tabs:

- **By user**: stacked bar chart of hours per project per user.
- **By project**: pie chart of hours per project.
- **By activity**: pie chart of hours per activity (e.g., Development, Management, Documentation).
- **By WP**: list of WPs with hours, sorted.
- **Custom**: drag fields into rows/columns/values to build a custom report (like a pivot table).

All reports can be exported to CSV, XLSX, PDF.

### 8.5 Hourly rates

```
model HourlyRate {
  id        String   @id @default(cuid())
  userId    String
  rate      Decimal  @db.Decimal(10,2)
  currency  String   @default("USD")
  validFrom DateTime
  validTo   DateTime?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

A user's rate is the rate with the most recent `validFrom` on the entry date. Default rate: 0 (free).

### 8.6 Budget tracking integration

See §9. Time entries contribute to `spent` on budgets.

---

## 9. Budgets & Cost Tracking

### 9.1 Per project

Implemented (`Budget`). Add:

- `Budget.kind` — `fixed` (a hard cap), `flexible` (a soft target), `timeAndMaterials` (track only).
- `Budget.alertAtPercent` — when `spent / planned > alertAtPercent`, notify Project Manager and watchers.
- `Budget.currency` — single currency per budget.

### 9.2 Per work package

Add to `WorkPackage`:

```
laborBudget     Float  @default(0)  // in budget currency
materialBudget  Float  @default(0)
unitCost        Float  @default(0)
units           Float  @default(0)
```

These roll up to the project's `Budget` automatically. A WP detail tab "Budget" shows:
- Planned cost (labor + material + units).
- Actual cost (logged time × rate + material).
- Variance.

### 9.3 Labor + unit + material cost

- **Labor cost** = `Σ timeEntry.hours × user.rate` for the WP.
- **Unit cost** = `unitCost × units` (configurable units like "licences", "pages", "items").
- **Material cost** = a separate table:

```
model MaterialEntry {
  id          String  @id @default(cuid())
  workPackageId String
  description String
  cost        Decimal
  currency    String
  quantity    Float   @default(1)
  occurredOn  DateTime
  workPackage WorkPackage @relation(fields: [workPackageId], references: [id], onDelete: Cascade)
}
```

The total cost of a WP is `labor + unit + Σ material`.

### 9.4 Forecast vs actual

For each `Budget`, the system computes:

- **Actual** = sum of costs of all WPs in the project that contribute to this budget.
- **Forecast** = actual + (planned for unfinished WPs × average historical burn rate).

A line chart shows planned, actual, and forecast over time. When the forecast exceeds `Budget.planned` and `kind = fixed`, a banner is shown to Managers.

---

## 10. Meetings

### 10.1 Agenda + minutes

Already implemented (`Meeting`, `MeetingAgendaItem`, `MeetingMinutes`). Enhance:

- Drag-and-drop reorder of agenda items.
- Time-box per agenda item (start + duration; the meeting view highlights the current item).
- Minutes can be edited live during the meeting (collaborative editing via Yjs or operational transform).
- Auto-save every 5 seconds; explicit "Save version" creates a snapshot.

### 10.2 Time slot reservations

A "Schedule meeting" flow lets the meeting creator:

1. Pick a date range (e.g., next 7 days).
2. Pick a duration (e.g., 1h).
3. Pick required attendees.
4. The system polls the iCal feeds (Google/Outlook, see §19.6) and returns slots where all required attendees are free.
5. The creator selects a slot, the meeting is created with the chosen time, and calendar invites are sent via the integration.

### 10.3 Action items as work packages

Inside the meeting minutes, an "Add action item" button creates a work package pre-filled with:
- Subject from the action item text.
- Type = "Task" (configurable per project).
- Project = the meeting's project.
- Linked back to the meeting via a `meetingId` field on the WP.

The action item appears in the meeting's minutes with a deep link to the WP. The WP's activity stream shows "Created from meeting: Q2 planning" with a back-link.

### 10.4 Recurring meeting series

```
model MeetingSeries {
  id        String   @id @default(cuid())
  projectId String
  title     String
  interval  RecurInterval
  every     Int
  startTime String   // "09:00"
  duration  Int      // minutes
  weekdays  Int[]    // [1,2,3,4,5]
  startDate DateTime
  endDate   DateTime?
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  meetings  Meeting[]
}
```

A cron job (or Next.js scheduled function) creates the next instance when the previous one is completed.

---

## 11. Forums

### 11.1 Categories

Add to `Forum`:

```
model Forum {
  ... existing ...
  categoryId String?
  category   ForumCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
}

model ForumCategory {
  id        String  @id @default(cuid())
  forumId   String
  name      String
  position  Int
  forum     Forum   @relation(fields: [forumId], references: [id], onDelete: Cascade)
}
```

Admins create categories per forum. The forum page lists categories with thread counts.

### 11.2 Sticky threads

Add to `ForumThread`:

```
isSticky     Boolean  @default(false)
isLocked     Boolean  @default(false)
isAnnouncement Boolean @default(false)
```

Sticky threads always appear at the top. Locked threads cannot receive new posts. Announcements are visually distinct (📌 icon) and excluded from "Latest" lists.

### 11.3 Polls

```
model ForumPoll {
  id        String  @id @default(cuid())
  threadId  String
  question  String
  multiple  Boolean @default(false)
  closesAt  DateTime?
  thread    ForumThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  options   ForumPollOption[]
}

model ForumPollOption {
  id     String  @id @default(cuid())
  pollId String
  text   String
  poll   ForumPoll @relation(fields: [pollId], references: [id], onDelete: Cascade)
  votes  ForumVote[]
}
```

`ForumVote` already exists; just relate it to options. UI renders the poll with radio buttons (single choice) or checkboxes (multiple choice), shows live results, and a closing date.

### 11.4 Moderation

- **Lock/unlock thread** (Manager+).
- **Pin/unpin thread** (Manager+).
- **Move thread to another forum/category** (Manager+).
- **Delete post** (soft delete with reason, visible to admins) (Manager+).
- **Ban user** from a specific forum (Admin).
- **Moderation log** (Admin) — append-only audit of all mod actions.

### 11.5 Reactions and mentions

- Reactions on posts (same set as WP comments).
- @mentions trigger notifications per §16.

---

## 12. Wiki

### 12.1 Markdown

Implemented. Enhance with:

- Code block syntax highlighting (Shiki or Prism).
- MathJax support.
- Mermaid diagram support (rendered server-side, cached).
- Footnotes.
- Tables (GFM).
- Task list checkboxes.

### 12.2 WYSIWYG editor

A toggle in the editor toolbar between **Markdown** (raw text + preview) and **WYSIWYG** (rich text with formatting buttons). We use **TipTap** (built on ProseMirror) which produces HTML internally but stores markdown as the source of truth.

Round-trip:
- On load, parse markdown to TipTap doc.
- On save, serialise TipTap doc back to markdown.
- A `data-fidelity` warning appears if the round-trip changes the text (e.g., unsupported HTML in source).

### 12.3 Page hierarchy

```
model WikiPage {
  ... existing ...
  parentId   String?
  parent     WikiPage?  @relation("WikiHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children   WikiPage[] @relation("WikiHierarchy")
  position   Int        @default(0)
}
```

The wiki sidebar shows a tree; users can drag pages to reorder or reparent. Breadcrumbs at the top of each page link to ancestors.

### 12.4 Macros

Implemented. Add new macros:

- `{{work_package(1234)}}` — embeds a WP card.
- `{{work_package_table(query=... )}}` — embeds a query result table.
- `{{child_pages}}` — lists child pages.
- `{{backlinks}}` — lists pages linking to this one.
- `{{recent_changes}}` — last N changes in the project.
- `{{toc}}` — auto-generated table of contents.
- `{{user(123)}}` — embeds a user card.
- `{{embed(url)}}` — embed a YouTube/Loom/Figma link with a preview.
- `{{include(PageName)}}` — include another page's content.
- `{{mention(@alice)}}` — creates a mention and notification.

### 12.5 Page history + diff

Implemented (`WikiPageVersion`). Add a **diff view**:

- Side-by-side or unified diff (toggle).
- Word-level diff (use `diff-match-patch`).
- "Compare any two versions" picker.
- "Restore this version" button (creates a new version identical to the chosen one, with author = current user).

### 12.6 Export to PDF

Use **Puppeteer** or **Playwright** to render the page (with CSS print stylesheet) to PDF. The page must be in a known state (no popovers, no edit toolbar). Add per-project header/footer with project name and date.

### 12.7 Inline comments

Optional. Adds a comment thread anchored to a span of text in the wiki page. Comments appear as margin notes. Use TipTap's mark system to store comment IDs in the doc.

---

## 13. Documents & File Storage

### 13.1 File storage (S3)

Add an S3-compatible backend option (in addition to local disk):

```
model Storage {
  id        String  @id @default(cuid())
  name      String
  provider  String  // "s3", "azure_blob", "gcs", "local"
  config    Json    // { bucket, region, accessKeyId, ... }
  projectId String?  // null = available to all
  project   Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

Files are uploaded directly to S3 via a presigned URL (the server returns the URL, the browser PUTs the file). On completion, the server registers the file in `ProjectFile`.

### 13.2 Version control

Implemented (`DocumentVersion`). Add:

- Hash-based deduplication (content-addressable).
- Diff for text files (`.txt`, `.md`, `.json`, code).
- Preview for common file types (image, video, audio, PDF) using a sandboxed iframe or a media proxy.

### 13.3 Folder hierarchy

Implemented (`DocumentFolder`). Add:

- Drag-and-drop reparenting.
- Breadcrumb navigation.
- Search within folder.
- Bulk download as ZIP.

### 13.4 Permissions

- Folder-level: read / write / manage.
- WP-level: each WP can have a "Files" tab with its own folder; the WP's permissions apply.
- Per-file sharing: a file can be shared with a public link (read-only, optional expiry and password).
- Role-based inheritance: by default, file permissions follow the project's roles; explicit overrides per folder/file.

### 13.5 Virus scan

Hook into the upload pipeline. After upload, the file is sent to a scanner (ClamAV local, or VirusTotal API). Files in `infected` state are quarantined and the uploader is notified.

---

## 14. News & Announcements

### 14.1 Project-scoped news

Implemented (`News`, `NewsComment`). Enhance:

- Cover image upload.
- Rich text with embedded WP references.
- Reactions.
- "Pin to top" for important news.

### 14.2 Global news

Implemented (`Announcement`). Enhance:

- Show on global dashboard.
- Optional dismiss per user.
- Categories (System, Product, Community).

### 14.3 Comments

Implemented. Extend with reactions and replies (same model as WP activity comments).

### 14.4 RSS feed

Expose `/news.rss` and `/projects/:id/news.rss` with valid RSS 2.0 XML.

---

## 15. Calendar

### 15.1 Views

- **Month** (default) — grid of days, each showing up to 3 WPs with overflow indicator.
- **Week** — hourly grid, WPs as blocks at their start/due times.
- **Day** — single day, hourly slots.
- **Agenda** — list of upcoming WPs, grouped by day.
- **Year** (optional) — high-density overview.

### 15.2 Filters

Filter by:
- Project (multi-select, with "All projects I'm a member of" option).
- Type (multi-select).
- Assignee (multi-select, including "Me").
- Status (multi-select).
- Custom fields.
- Date range (custom or "next 7 days", "this month", etc.).

### 15.3 iCal feed

Expose `/my/calendar.ics` (and per-project `/projects/:id/calendar.ics`) as a valid iCalendar feed. Subscribable in Google Calendar, Apple Calendar, Outlook. Updates within 15 minutes (cron refresh).

---

## 16. Notifications

### 16.1 In-app bell (already in place)

Keep. Add:

- Mark all as read.
- "Snooze" a notification (re-appears in N hours).
- Per-notification deep link to source.

### 16.2 Email

Implemented (`EmailQueue`). Enhance:

- Digest mode (daily/weekly summary instead of per-event).
- Per-project digest opt-in.
- Unsubscribe link with one-click preferences.
- HTML email template with project logo, actor avatar, diff snippets.

### 16.3 Push (web push)

Implement using the Web Push API + VAPID keys:

1. User opts in via Settings → Notifications → Enable browser push.
2. The browser registers a service worker; the SW returns a subscription object (endpoint + keys).
3. The server stores the subscription in `PushSubscription` and sends pushes via the `web-push` npm library.

```
model PushSubscription {
  id        String  @id @default(cuid())
  userId    String
  endpoint  String  @unique
  p256dh    String
  auth      String
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

The service worker shows a native OS notification with title, body, icon, and click-handler that opens the app at the right URL.

### 16.4 Per-event subscription

`NotificationSetting` already exists. Extend granularity:

| Event | Default | Channel toggle |
|---|---|---|
| `wp.created` | ☑ | in-app, email, push |
| `wp.updated` (any field) | ☐ | in-app, email, push |
| `wp.status_changed` | ☑ | in-app, email, push |
| `wp.priority_changed` | ☐ | in-app, email, push |
| `wp.assignee_changed` (I'm new) | ☑ | in-app, email, push |
| `wp.commented` (I'm watcher/author) | ☑ | in-app, email, push |
| `wp.time_logged` (I'm assignee) | ☐ | in-app, email, push |
| `wp.attachment_added` (I'm watcher) | ☐ | in-app, email, push |
| `wp.relation_added` (I'm assignee) | ☐ | in-app, email, push |
| `wp.mentioned` | ☑ | in-app, email, push |
| `meeting.invited` | ☑ | in-app, email, push |
| `meeting.starting_soon` (15 min) | ☐ | in-app, email, push |
| `forum.posted` (I'm watcher) | ☑ | in-app, email, push |
| `wiki.updated` (I'm watcher) | ☐ | in-app, email, push |
| `news.published` (project member) | ☑ | in-app, email |
| `budget.threshold_exceeded` | ☑ | in-app, email |
| `sprint.started` | ☑ | in-app, email, push |
| `sprint.completed` | ☑ | in-app, email |

A separate matrix exists for **"I'm the actor, don't notify me"** — global toggle.

### 16.5 Mobile push (FCM/APNs)

Out of scope for v2.1; relies on PWA + web push instead.

---

## 17. Search

### 17.1 Global search

Implemented (`pages/api/search`). Enhance:

- **Fuzzy matching** — use Postgres `pg_trgm` or MeiliSearch for typo tolerance.
- **Ranking** — score based on: title match weight, recency, project activity, user-specific boost.
- **Type-aware results** — group by entity (Work Packages, Projects, Wiki, Forum, Users, Files) with counts.
- **Highlighting** — `<mark>` around matched terms.
- **Filter chips** — quick filters (in current project, assigned to me, open status, etc.).

### 17.2 Saved searches

Implemented (`SavedQuery`, `Query`). Enhance:

- Shareable (with a public link).
- Subscribe (turn a saved search into a daily/weekly digest of new matches).
- Pin to sidebar for quick access.

### 17.3 Filters + sort

Implemented. Add:

- **Multi-level sort** — primary, secondary, tertiary keys.
- **Computed columns** — sort by `daysUntilDue` or `overdue` (boolean).
- **Filter chips UI** — modern Linear-style filter pills with one-click removal.

### 17.4 Jump-to (command palette)

A new `⌘K` / `Ctrl+K` palette shows a fuzzy search bar and a list of "jump to" actions:

- Recent WPs/projects.
- My open WPs.
- All WPs assigned to me.
- Settings pages.
- Help articles.
- Create new (WP, project, meeting, wiki page, etc.).
- Run a saved search.

Built using `cmdk` (the library behind Linear's palette).

---

## 18. Reports & Analytics

### 18.1 Burndown

Models already in place (`BurndownData`). Add the **UI**:

- Line chart with two series: actual remaining work, ideal burn.
- X axis = sprint days (incl. weekends shaded as non-working).
- Hover for tooltip: date, ideal hours, actual hours, completed WP count.
- Toggle between "hours" and "story points".

### 18.2 Velocity

- Bar chart: completed story points per sprint (last 10 sprints).
- Overlay: rolling average.
- Forecast: "If next sprint has 18 points, completion is on track / at risk / off track" based on the user's last 3 sprints.

### 18.3 Time spent

- Stacked bar chart: hours per project per week.
- Pie chart: hours per type per project.
- Treemap: hours per WP, sized by estimated time.

### 18.4 Custom reports

A new "Report builder" page:

- **Rows** (one or more dimensions): project, type, assignee, priority, version, custom field, date.
- **Columns** (one or more dimensions): same as rows, supports pivoting.
- **Values** (one or more measures): count, hours (sum/avg), cost, % done (avg).
- **Filters** (any field).
- **Visualisation** (auto-pick or manual): table, bar, line, pie, treemap.

The report can be saved, shared, exported, or scheduled (sent by email daily/weekly/monthly).

### 18.5 Cross-project rollup

A "Portfolio" view that aggregates metrics across multiple projects: total WPs open, % done, hours spent vs planned, budget utilisation. Useful for executives.

---

## 19. NEW Features Beyond Original OpenProject

### 19.1 AI assist

#### 19.1.1 Scope

Three AI features, all opt-in per instance and per user:

1. **Assignee suggestion** — given a new WP's subject, description, type, and project, suggest the user most likely to take it (based on past WPs of similar type, current workload, skills).
2. **Duration prediction** — given the WP fields, suggest an estimated time (based on similar past WPs).
3. **Thread summarisation** — given a comment thread > 5 messages, generate a 3-bullet summary with `@mentions` and `action items` extracted.

#### 19.1.2 Architecture

- A separate `ai-service` (a Next.js API route, optionally deployable as an Edge Function).
- Uses **OpenAI / Anthropic / local LLM** (configurable per instance).
- The prompt template + few-shot examples are stored in the DB and editable by admins.
- No data leaves the instance unless the admin configures an external provider; the local LLM option is default for privacy-sensitive deployments.
- Telemetry: each AI call logs tokens used, latency, model, and user feedback ("👍 / 👎" button on suggestions).

#### 19.1.3 UI

- A small "✨" button in the work package form opens a side panel with suggestions.
- For thread summary, a "🪄 Summarise" button appears when a thread is > 5 messages.

### 19.2 Mobile app (PWA)

Convert the existing web app into a **Progressive Web App**:

- `manifest.json` with icons, theme colour, display = `standalone`.
- Service worker (Workbox) for offline shell + asset caching.
- Push notifications via the same `PushSubscription` (§16.3).
- "Add to home screen" prompt.
- Native-feel bottom navigation on small screens.
- Camera/microphone access for voice notes and photo attachments.

A future native app (React Native or Flutter) can wrap the PWA and reuse 90% of the code.

### 19.3 Offline mode

Service worker caches:
- **App shell** (HTML, CSS, JS, fonts) — `CacheFirst`.
- **API GET responses** for the user's recent projects, recent WPs, the global dashboard — `StaleWhileRevalidate`.
- **Mutation queue**: when offline, the user can create/edit WPs. These are stored in IndexedDB and replayed when the connection returns. Conflicts are resolved with a "merge or keep local" dialog.

### 19.4 Slack integration

- OAuth app in Slack; users link their account from Settings.
- Slash command `/op create task Implement OAuth2 PKCE` creates a WP.
- Notifications posted to channels: when a WP is created/updated/closed, the configured channel gets a message with a deep link back to OP.
- Bidirectional: reacting with ✅ in Slack closes the WP; reacting with 👀 marks the WP as watched.
- Daily digest: every morning at 9am, a summary of "Your open WPs today" is DM'd to each user.

### 19.5 Microsoft Teams integration

- Teams app manifest.
- Tab: embed an OP project view in a Teams channel.
- Bot: `@op create task ...`, `@op list my tasks`, `@op status of #1234`.
- Notifications: configurable per channel.
- Adaptive Cards for action items (approve, comment, log time).

### 19.6 Calendar sync (Google, Outlook)

- OAuth 2.0 per provider; tokens stored encrypted.
- **Two-way sync**: WPs with a `dueDate` appear in the user's external calendar; events created in the external calendar with a special category ("OP") create new WPs in the user's default project.
- **Per-user conflict resolution**: when an external event overlaps a WP, the user picks "treat as busy" (default) or "ignore".
- **Meeting sync**: see §10.2.

### 19.7 GitHub / GitLab integration (better than current)

The existing repository model (`Repository`, `Commit`, `CommitWorkPackage`) is for read-only Git inspection. We extend:

- **OAuth app** in GitHub/GitLab.
- **Webhook receiver** for `push`, `pull_request`, `issue_comment` events.
- **Auto-link**: PRs/branches/commits with a magic string in the message (e.g., `OP#1234` or `Fixes #1234`) are linked to the WP.
- **Status sync**: WP status is mirrored in the PR label (e.g., "In progress" → `status: in-progress`).
- **CI status**: a "checks" tab on the WP shows CI status for linked PRs.
- **Smart commits**: comments on the WP can be made via `git commit -m "#1234 @alice this fixed it"`.

### 19.8 Voice notes

On the WP activity composer and meeting minutes editor, a "🎤 Record" button uses the browser's `MediaRecorder` API to capture audio. The audio is uploaded to S3, optionally transcribed via Whisper API, and stored as an attachment with a transcript alongside.

### 19.9 Video calls (Zoom, Google Meet, Microsoft Teams)

- OAuth per provider.
- On any meeting or WP, a "📹 Start video call" button creates a meeting and posts the join link.
- The link is shown in the WP/activity/meeting UI; a "Join" button opens the provider's web client.
- Recordings (if enabled by the provider) are fetched and attached to the meeting record.

### 19.10 Public sharing (read-only links)

- Any project, WP, wiki page, or board can be shared via a tokenised URL.
- Tokens carry: read-only access, optional expiry (date or max-uses), optional password.
- Tokens are stored hashed.
- Public viewers see a stripped-down UI (no admin nav, no API tokens, no PII of internal members).
- SEO: `noindex,nofollow` by default; admins can opt in.

### 19.11 Templates marketplace

- **Public catalog**: openproject.io/templates lists free community templates (PMO, software dev, marketing, construction, etc.).
- **Install** flow: a one-click copy of a template's data model (types, statuses, workflows, custom fields) into the local instance.
- **Authoring**: anyone can publish a template; rating system; fork-and-extend.
- **Paid templates** (optional, future): monetised by template authors.

### 19.12 Workflow automation (Zapier-style)

#### 19.12.1 Concept

A native **trigger → condition → action** builder that lives in OP itself. Eliminates the need for Zapier/Make for 80% of use cases.

#### 19.12.2 Triggers

- `wp.created`
- `wp.updated`
- `wp.status_changed`
- `wp.commented`
- `wp.time_logged`
- `wp.assigned`
- `wp.due_date_approaching` (N days)
- `wp.overdue`
- `sprint.started`
- `sprint.completed`
- `budget.threshold_exceeded`
- `wiki.updated`
- `meeting.starting_soon`
- `webhook.received` (from an external source)
- `schedule.daily` / `schedule.weekly` / `schedule.cron`
- `form.submitted` (see §19.13)

#### 19.12.3 Conditions

A JSON DSL with operators (eq, neq, gt, lt, in, not_in, is_set, is_unset, contains, matches_regex, days_since, hours_since, due_in_days, has_tag, project_is, type_is, role_is, custom_field_X).

Conditions are ANDed by default; OR groups can be added.

#### 19.12.4 Actions

- `wp.create` — create a new WP with templated fields.
- `wp.update` — update fields of the triggering WP or a related one.
- `wp.assign` — set assignee.
- `wp.comment` — add a system comment.
- `wp.add_watcher` — add a user as watcher.
- `wp.add_relation` — add a relation to another WP.
- `email.send` — send a templated email.
- `notification.send` — send an in-app notification.
- `webhook.fire` — call an external URL.
- `slack.post` — post to a Slack channel.
- `sprint.create` — start a new sprint with these WPs.
- `time.log` — auto-log time.
- `delay` — pause for N minutes/hours/days.
- `branch` — if/else.
- `loop` — for each related WP / for each watcher.

#### 19.12.5 UI

A visual builder in `Admin → Automation`. Each rule is a horizontal pipeline of cards (trigger, condition blocks, action blocks) with a drag-to-reorder handle. A "Test" button runs the rule against historical data and shows what would have happened.

#### 19.12.6 Limits

Per instance, configurable: max rules per project, max actions per run, max runs per hour (rate limit), max external HTTP calls per day (cost control).

### 19.13 Forms (standalone)

A **Form** is a publicly accessible URL that creates a WP on submission. Useful for bug reports, support requests, RFP intake.

- A new "Forms" module in projects.
- Each form has: title, description, fields (subject, description, custom fields, file upload), redirect URL, success message.
- The form URL is shareable; submissions create WPs of a chosen type, with auto-assignment.
- Captcha, rate limiting, optional email confirmation.
- Submissions feed the `wp.created` automation trigger.

### 19.14 Recurring work packages

See model in §3.2 (`RecurringWorkPackage`). UI:

- On a WP, "Make recurring" → pick interval (daily/weekly/monthly/yearly/cron).
- Pick which fields to override per occurrence (e.g., assignee rotates).
- "Next N occurrences" preview.
- Toggle on/off from the WP detail.

### 19.15 Checklists

A simple nested checklist on any WP:

```
model Checklist {
  id        String  @id @default(cuid())
  workPackageId String
  subject   String
  position  Int
  workPackage WorkPackage @relation(fields: [workPackageId], references: [id], onDelete: Cascade)
  items     ChecklistItem[]
}

model ChecklistItem {
  id          String  @id @default(cuid())
  checklistId String
  text        String
  done        Boolean @default(false)
  position    Int
  assigneeId  String?
  dueOn       DateTime?
  checklist   Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
}
```

Renders as a Trello-style checklist on the WP. Optionally contributes to the WP's `% done`.

### 19.16 eSignature for approvals

For WP types that represent contracts, change requests, or any approval-gated item, an eSignature flow:

- The WP enters a status like "Pending signature".
- The responsible + N other users are designated signers.
- Each signer is emailed a unique link; clicking it shows the WP and an "I approve" / "I reject" + optional comment button.
- All signatures are recorded in an immutable audit log with timestamp, IP, user agent.
- When all signers approve, the WP auto-transitions to "Approved" (workflow-driven).

```
model Signature {
  id          String  @id @default(cuid())
  workPackageId String
  signerId    String
  decision    SignatureDecision  // PENDING, APPROVED, REJECTED
  comment     String?
  signedAt    DateTime?
  ipAddress   String?
  userAgent   String?
  workPackage WorkPackage @relation(fields: [workPackageId], references: [id], onDelete: Cascade)
}

enum SignatureDecision { PENDING APPROVED REJECTED }
```

### 19.17 OKR tracking

- A new entity `Objective` with key results.
- Each key result can be a metric ("increase NPS to 50") or a list of WPs ("complete these 5 WPs").
- Progress is auto-calculated from linked WPs or manually entered.
- Objectives live in a project (or in a global "company" project) and roll up to parent objectives.
- A "Strategy" view renders an OKR tree (parent → child objectives → key results).

```
model Objective {
  id        String  @id @default(cuid())
  projectId String
  parentId  String?
  title     String
  description String?
  startDate DateTime
  endDate   DateTime
  status    ObjectiveStatus  // ON_TRACK, AT_RISK, OFF_TRACK, COMPLETED
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent    Objective? @relation("ObjectiveHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children  Objective[] @relation("ObjectiveHierarchy")
  keyResults KeyResult[]
}

model KeyResult {
  id          String  @id @default(cuid())
  objectiveId String
  title       String
  target      Float
  current     Float  @default(0)
  unit        String  // "%", "$", "count"
  objective   Objective @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  workPackageIds String[]  // WPs contributing to this KR
}
```

### 19.18 Risk register

A project-level register of risks, each with:

- Title, description, category (Technical, Financial, Legal, Operational, Reputational, Other).
- Probability (1-5).
- Impact (1-5).
- Risk score = probability × impact (auto-computed).
- Mitigation plan, owner, status (Open, Mitigating, Closed, Accepted).
- Linked WPs (mitigation tasks).
- Review date.

```
model Risk {
  id          String  @id @default(cuid())
  projectId   String
  title       String
  description String?
  category    String
  probability Int      // 1-5
  impact      Int      // 1-5
  score       Int      // auto = probability * impact
  status      RiskStatus
  ownerId     String?
  reviewOn    DateTime?
  mitigation  String?
  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  mitigationWorkPackageIds String[]
}
```

A heatmap visualisation (5x5 grid) groups risks by score. A "Review queue" lists risks with `reviewOn <= today`.

### 19.19 Dashboards (enhanced)

The global dashboard becomes a **widget-based home page**:

- Widgets are draggable, resizable, configurable.
- Widget library: My open WPs, My watched WPs, Project status, Burndown, Time tracked this week, Calendar, News, Announcements, Recent activity, My objectives, Risks needing review, Budget alerts, Custom query.
- A "My page" (`/my-page`) is a personal dashboard; admins can define a default layout.

### 19.20 Audit log

- Every state-changing action (create, update, delete) writes to an `AuditLog`.
- Fields: actor, action, resource type, resource id, before, after, IP, user agent, timestamp.
- Admins can search the audit log and export it.
- WPs, projects, users, settings, and integrations all log to the same table.

### 19.21 Permissions: attribute-based (ABAC) on top of RBAC

For highly regulated deployments, allow **conditions** on roles:

- "User can edit WP only if status is not 'Closed'".
- "User can see WP only if their department matches the WP's department CF".

A simple JSON DSL evaluates per request. Stored as a column on `Permission` and evaluated in the authorisation layer.

---

## 20. Workflow Definitions (Methodology)

### 20.1 Agile Scrum

```
Product Backlog
     │
     ▼  (Sprint Planning: pick items for sprint)
Sprint Backlog
     │
     ▼  (Daily standup; WPs move: To Do → In Progress → Review)
Sprint (active)
     │
     ▼  (Sprint Review: demo, accept/reject)
Sprint (review)
     │
     ▼  (Sprint Retrospective: what went well/wrong)
Sprint (retrospective)
     │
     ▼  (All WPs done: mark sprint completed)
Sprint (completed)
```

#### 20.1.1 Statuses (default Scrum)

`New → To Do → In Progress → In Review → Done → Closed`

Additional (optional): `Blocked`, `Ready for QA`, `QA Failed`.

#### 20.1.2 Workflow config (Scrum for "Task" type)

| From | To | Reporter | Contributor | Manager | Admin |
|---|---|---|---|---|---|
| New | To Do | ☑ | ☑ | ☑ | ☑ |
| To Do | In Progress | ☐ | ☑ | ☑ | ☑ |
| In Progress | In Review | ☐ | ☑ | ☑ | ☑ |
| In Review | Done | ☐ | ☑ | ☑ | ☑ |
| In Review | In Progress | ☐ | ☑ | ☑ | ☑ |
| Done | Closed | ☐ | ☐ | ☑ | ☑ |
| Done | In Progress | ☐ | ☐ | ☑ | ☑ |
| any | Blocked | ☐ | ☑ | ☑ | ☑ |
| Blocked | (prev) | ☐ | ☑ | ☑ | ☑ |

#### 20.1.3 Automation

- When a WP is moved to "In Review", automation rule: `assignee = author of last commit touching the WP` (if Git integration).
- When a WP is moved to "Done", automation: `set % done = 100`, `set spent time = estimated time if not already set`.
- When a Sprint is completed, automation: `move all WPs still in 'In Progress' back to product backlog` (or to a follow-up sprint).

### 20.2 Kanban

```
Backlog → Ready → Doing → Review → Done
```

- No fixed sprint; continuous flow.
- Each column has a WIP limit (soft/hard).
- The board's swimlanes (e.g., by priority or type) make bottlenecks visible.
- Cycle time and lead time are tracked automatically.

#### 20.2.1 Default WIP limits

| Column | Suggested WIP |
|---|---|
| Ready | 20 |
| Doing | 5 |
| Review | 3 |
| Done | (unlimited; auto-archive after 7 days) |

#### 20.2.2 Workflow config (Kanban for "Task" type)

| From | To | All roles |
|---|---|---|
| Backlog | Ready | ☑ |
| Ready | Doing | ☑ |
| Doing | Review | ☑ |
| Review | Doing | ☑ |
| Review | Done | ☑ |
| Doing | Ready | ☑ (pull back) |
| any | Blocked | ☑ |

### 20.3 Waterfall

- Strictly sequential phases: Requirements → Design → Implementation → Verification → Maintenance.
- Each phase has its own WP type and its own set of statuses.
- Gantt with FS dependencies is the primary planning tool.
- Phase gates (WPs of type "Gate") require a manual sign-off (eSignature) to transition to the next phase.

#### 20.3.1 Default types and statuses

| Type | Statuses |
|---|---|
| Requirement | Draft, Approved, Rejected, Decomposed |
| Design | Draft, Review, Approved |
| Implementation | Planned, In Progress, Code Review, Done |
| Verification | Planned, Executing, Passed, Failed |
| Maintenance | Scheduled, Active, Closed |

#### 20.3.2 Workflow config (Waterfall)

For each type, define the linear chain above. Use **eSignature** (see §19.16) on the "Gate" type to require sign-off from the Project Manager and a Sponsor role before moving to the next phase.

### 20.4 Hybrid (Agile dev + Waterfall deployment)

- The development project uses Scrum (see §20.1) with sprints and a product backlog.
- A separate "Release" project uses Waterfall (see §20.3) with a phased release plan: Staging → UAT → Production.
- WPs from the dev project can be **promoted** to the release project (creating a release ticket) when they reach "Done".
- The release project's Gantt shows the deployment schedule and dependencies.
- Automation: when a release ticket transitions to "Deployed", the linked dev WPs are auto-closed.

#### 20.4.1 Recommended setup

1. **Project A — Engineering (Scrum)**: WPs of types Task, Bug, Spike, Epic. Sprints via the backlogs module.
2. **Project B — Releases (Waterfall)**: WPs of type Release. Each release has a Gantt with FS dependencies on environments (Staging → UAT → Prod).
3. **Cross-project relations**: each Release WP has a `follows` relation to all engineering WPs included in that release.
4. **Automation rule**:
   - Trigger: `wp.updated` where `type = Task and status changed to Done`
   - Condition: `wp has relation follows Release WP where status = "In progress"`
   - Action: `add comment on Release WP: "✅ #1234 (task subject) is done — ready for staging"`

---

## 21. Permission Matrix

The matrix below lists the canonical permissions and the roles that have them by default. Admins can override any cell.

Legend: ✓ = always allowed, ✗ = never allowed, ★ = allowed if the user is the WP's author/assignee/responsible, ◐ = allowed for own profile only, ◇ = allowed with project membership.

### 21.1 Work package permissions

| Permission | Anon | Reader | Guest | Reporter | Contributor | Manager | Admin |
|---|---|---|---|---|---|---|---|
| `wp.view` | ◇ (public projects) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `wp.create` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `wp.edit` | ✗ | ✗ | ✗ | ★ (own, draft only) | ✓ | ✓ | ✓ |
| `wp.delete` | ✗ | ✗ | ✗ | ✗ | ★ (own draft) | ✓ | ✓ |
| `wp.change_status` | ✗ | ✗ | ✗ | ★ (own, via workflow) | ✓ (via workflow) | ✓ | ✓ |
| `wp.assign` | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `wp.add_watcher` | ✗ | ✗ | ✗ | ★ (self) | ✓ | ✓ | ✓ |
| `wp.log_time` | ✗ | ✗ | ✗ | ✓ (own time) | ✓ | ✓ | ✓ |
| `wp.approve_time` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `wp.add_comment` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `wp.add_relation` | ✗ | ✗ | ✗ | ★ (own) | ✓ | ✓ | ✓ |
| `wp.export` | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `wp.move_to_project` | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `wp.bulk_edit` | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `wp.archive` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

### 21.2 Project permissions

| Permission | Anon | Reader | Guest | Reporter | Contributor | Manager | Admin |
|---|---|---|---|---|---|---|---|
| `project.view` | ◇ (public) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project.create` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `project.edit` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.delete` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `project.archive` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.copy` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.create_subproject` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.manage_members` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.manage_modules` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.manage_types` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.manage_workflow` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.manage_categories` | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `project.manage_versions` | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `project.manage_custom_fields` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.export` | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project.manage_settings` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.manage_storage` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `project.manage_automations` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

### 21.3 Wiki, Forum, Documents, Meetings

| Permission | Anon | Reader | Guest | Reporter | Contributor | Manager | Admin |
|---|---|---|---|---|---|---|---|
| `wiki.view` | ◇ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `wiki.edit` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `wiki.create_page` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `wiki.delete_page` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `wiki.export` | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `forum.view` | ◇ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `forum.post` | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `forum.create_thread` | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `forum.moderate` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `documents.view` | ◇ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `documents.upload` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `documents.edit` | ✗ | ✗ | ✗ | ★ (own upload) | ✓ | ✓ | ✓ |
| `documents.delete` | ✗ | ✗ | ✗ | ★ (own) | ✓ | ✓ | ✓ |
| `meetings.view` | ◇ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `meetings.create` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `meetings.edit_agenda` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `meetings.edit_minutes` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `meetings.delete` | ✗ | ✗ | ✗ | ✗ | ★ (own) | ✓ | ✓ |

### 21.4 Budget, Time, Reports

| Permission | Anon | Reader | Guest | Reporter | Contributor | Manager | Admin |
|---|---|---|---|---|---|---|---|
| `budget.view` | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `budget.edit` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `budget.delete` | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| `time.view_own` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `time.view_all` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `time.edit_own` | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| `time.edit_any` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `time.approve` | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `reports.view` | ✗ | ✗ | ✗ | ★ (own) | ✓ | ✓ | ✓ |
| `reports.create` | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `reports.share` | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `reports.export` | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |

### 21.5 Admin (system-wide)

| Permission | Admin only |
|---|---|
| `admin.users.manage` | ✓ |
| `admin.roles.manage` | ✓ |
| `admin.groups.manage` | ✓ |
| `admin.ldap.manage` | ✓ |
| `admin.scim.manage` | ✓ |
| `admin.oauth.manage` | ✓ |
| `admin.saml.manage` | ✓ |
| `admin.webhooks.manage` | ✓ |
| `admin.api_keys.manage` | ✓ |
| `admin.automations.manage` | ✓ |
| `admin.branding.manage` | ✓ |
| `admin.announcements.manage` | ✓ |
| `admin.help.manage` | ✓ |
| `admin.audit.view` | ✓ |
| `admin.backup.manage` | ✓ |
| `admin.email.manage` | ✓ |
| `admin.storage.manage` | ✓ |
| `admin.ai.configure` | ✓ |

### 21.6 Authorisation resolution algorithm

For a given user U, project P, action A, resource R:

1. **Direct membership**: if U is a direct member of P with role(s) ROLES, then ALLOW if any role grants A.
2. **Group membership**: if U is in group G and G is a member of P with role ROLES, then ALLOW if any role grants A.
3. **Inheritance**: if P has parent P', apply rules 1 and 2 to P' (recursively).
4. **Type-specific workflow**: for `wp.change_status`, the user must also have a workflow row (type, role, fromStatus, toStatus) allowing this transition.
5. **Resource-specific check**: for `wp.edit`, the WP's author/assignee/responsible special case applies.
6. **ABAC conditions**: if the permission has a condition, evaluate it against the resource.
7. **ABAC deny rules**: explicit deny rules win over allow.

---

## 22. Notification Triggers

Each notification has: `recipient`, `event`, `channel`, `payload`. Triggers below list the conditions that cause a notification to be enqueued.

### 22.1 Work package events

| Event | Recipients | Trigger condition | Default channels |
|---|---|---|---|
| `wp.created` | watchers (incl. author, assignee, responsible) | WP created | in-app, email |
| `wp.updated` | watchers | any field changed AND user wants updates | in-app (off by default) |
| `wp.status_changed` | watchers, responsible, assignee | status field changed | in-app, email |
| `wp.priority_changed` | assignee, responsible | priority field changed | in-app |
| `wp.assignee_changed` | new assignee (if different from old) | assignee field set | in-app, email |
| `wp.responsible_changed` | new responsible | responsible field set | in-app, email |
| `wp.due_date_approaching` | assignee, responsible | due date in 1/3/7 days (user config) | in-app, push |
| `wp.overdue` | assignee, responsible | due date < now AND status not closed | in-app, email, push |
| `wp.commented` | watchers, mentioned users | new comment | in-app, email |
| `wp.mentioned` | mentioned user | @mention in comment | in-app, email, push |
| `wp.time_logged` | assignee, watchers (opt-in) | time entry created/updated | in-app |
| `wp.attachment_added` | watchers (opt-in) | file attached | in-app |
| `wp.relation_added` | assignee of related WP, watchers of related WP (opt-in) | relation created | in-app |
| `wp.watcher_added` | newly added user | added as watcher | in-app, email |
| `wp.signed` | signers, watchers | eSignature completed | in-app, email |

### 22.2 Project events

| Event | Recipients | Trigger condition | Default channels |
|---|---|---|---|
| `project.member_added` | new member | role assigned | in-app, email |
| `project.member_removed` | removed user | role revoked | in-app, email |
| `project.archived` | members | project archived | in-app, email |
| `project.wiki_updated` | watchers (opt-in) | wiki page changed | in-app |
| `project.news_published` | members | news created | in-app, email |
| `project.budget_alert` | managers, project leads | budget threshold reached | in-app, email |

### 22.3 Meeting events

| Event | Recipients | Trigger | Default |
|---|---|---|---|
| `meeting.invited` | attendees | meeting created | in-app, email, push |
| `meeting.starting_soon` | attendees | 15 min before start (user config: 5/15/30) | in-app, push |
| `meeting.updated` | attendees | time/location changed | in-app, email |
| `meeting.cancelled` | attendees | status = cancelled | in-app, email, push |
| `meeting.action_item_created` | assignee, watchers of source WP | action item WP created from meeting | in-app, email |

### 22.4 Forum events

| Event | Recipients | Trigger | Default |
|---|---|---|---|
| `forum.posted` | thread subscribers | new post in thread | in-app, email |
| `forum.mentioned` | mentioned user | @mention | in-app, email, push |
| `forum.moderation_action` | target user (if not bulk) | thread locked/pinned/moved/deleted | in-app, email |

### 22.5 Sprint events

| Event | Recipients | Trigger | Default |
|---|---|---|---|
| `sprint.planned` | team members | sprint created with WPs | in-app, email |
| `sprint.started` | team members, product owner | sprint start date reached or manually started | in-app, email, push |
| `sprint.completed` | team members, product owner | sprint marked complete | in-app, email |
| `sprint.burndown_warning` | scrum master, product owner | 2 consecutive days over ideal | in-app, email |

### 22.6 System events

| Event | Recipients | Trigger | Default |
|---|---|---|---|
| `system.announcement` | all users | announcement published | in-app, email |
| `system.maintenance` | all users | scheduled maintenance window | in-app, email |
| `system.password_changed` | self | password updated | in-app, email |
| `system.2fa_enrolled` | self | 2FA added/removed | in-app, email |
| `system.api_key_created` | self | new API key | in-app, email |

### 22.7 Notification throttling

- The same user does not receive > 1 notification per WP per 60 seconds (debounced).
- Email digests bundle up to 1 hour of notifications (configurable).
- Users can mute a WP ("stop notifying me about this WP") — adds an opt-out flag stored in `WorkPackageWatcher`.

### 22.8 Quiet hours

User-configurable: do not send push/email between 22:00 and 07:00 local time. In-app notifications are still queued and shown on next login.

---

## 23. Webhook Events

### 23.1 Webhook delivery model

```
model Webhook {
  id          String   @id @default(cuid())
  name        String
  url         String
  secret      String   // for HMAC signing
  events      String[] // event names
  active      Boolean  @default(true)
  projectId   String?  // null = system-wide
  headers     Json?    // custom headers
  retries     Int      @default(5)
  project     Project? @relation(...)
  deliveries  WebhookDelivery[]
}

model WebhookDelivery {
  id          String   @id @default(cuid())
  webhookId   String
  event       String
  payload     Json
  responseCode Int?
  responseBody String?
  error       String?
  attemptedAt DateTime @default(now())
  completedAt DateTime?
  webhook     Webhook  @relation(...)
  @@index([webhookId, attemptedAt])
}
```

### 23.2 Event catalogue

| Event | Payload includes |
|---|---|
| `work_package.created` | full WP object |
| `work_package.updated` | WP object, list of changed fields, before/after values |
| `work_package.deleted` | WP id, type, project id |
| `work_package.status_changed` | WP id, old status, new status, actor |
| `work_package.assigned` | WP id, old assignee, new assignee |
| `work_package.commented` | WP id, comment object |
| `work_package.attachment_added` | WP id, file object |
| `work_package.relation_added` | WP id, related WP id, relation type |
| `work_package.time_logged` | WP id, time entry object |
| `work_package.watcher_added` | WP id, user id |
| `project.created` | project object |
| `project.updated` | project object, changed fields |
| `project.archived` | project id |
| `project.member_added` | project id, user id, role ids |
| `project.member_removed` | project id, user id |
| `wiki.page_created` | page object |
| `wiki.page_updated` | page object, diff |
| `wiki.page_deleted` | page id, title |
| `forum.thread_created` | thread object |
| `forum.post_created` | post object, thread id |
| `meeting.created` | meeting object |
| `meeting.updated` | meeting object, changed fields |
| `meeting.cancelled` | meeting id |
| `sprint.started` | sprint object |
| `sprint.completed` | sprint object, completed WP ids |
| `budget.threshold_reached` | budget object, current spend, threshold |
| `time_entry.created` | time entry object |
| `time_entry.approved` | time entry object, approver |
| `form.submitted` | form id, submission object, created WP id |
| `automation.executed` | rule id, trigger event, action results |
| `automation.failed` | rule id, error, action index |
| `user.created` | user object (without password) |
| `user.updated` | user object, changed fields |
| `user.deactivated` | user id |
| `custom_field.value_changed` | entity type, entity id, custom field id, old, new |

### 23.3 Payload format

```json
{
  "event": "work_package.status_changed",
  "id": "evt_01HXXX...",
  "occurred_at": "2026-06-06T12:34:56.789Z",
  "actor": { "id": "u_42", "name": "Alice Example", "email": "alice@example.com" },
  "project": { "id": "p_7", "identifier": "acme-billing" },
  "data": {
    "work_package": { "id": "wp_1234", "subject": "Implement OAuth PKCE", "type": "Feature" },
    "old_status": "In progress",
    "new_status": "In review"
  },
  "links": {
    "self": "https://op.example.com/work_packages/1234",
    "api": "https://op.example.com/api/v3/work_packages/1234"
  }
}
```

### 23.4 Signing

Each delivery includes the headers:

- `X-OpenProject-Event: work_package.status_changed`
- `X-OpenProject-Delivery: <uuid>`
- `X-OpenProject-Signature: sha256=<hex>` (HMAC of the body using the webhook's secret)

Receivers verify by recomputing the HMAC and comparing with `crypto.timingSafeEqual`.

### 23.5 Retry policy

- On non-2xx response or timeout (10 seconds), retry with exponential backoff: 1m, 5m, 30m, 2h, 12h.
- After max retries, mark delivery as `failed` and stop.
- An alert is sent to webhook owner if > 50% of deliveries in the last hour fail.
- Admins can manually replay a delivery from the webhook delivery log.

### 23.6 Per-event filtering

The `Webhook.events` column is an array of event names. Only events in the list are sent. Use `*` to subscribe to all events.

### 23.7 Rate limits

- Per webhook: max 1000 deliveries / hour. Excess is queued and sent as fast as the rate limit allows.
- Per project: max 100 webhooks (configurable).

---

## 24. Implementation Roadmap

A 6-month, 3-phase rollout. Each phase is independently shippable.

### 24.1 Phase A (months 1-2) — Foundation

- Subprojects (data model + inheritance)
- Work package workflows (matrix editor + execution)
- Configurable forms per type
- Categories + severities
- Full relation types
- Recurring work packages
- @mentions + reactions on comments

### 24.2 Phase B (months 3-4) — Visualisation & Planning

- Gantt: dependencies (FS/SS/FF/SF), critical path, drag-to-move/resize
- Boards: column types, swimlanes, WIP limits strict mode
- Backlogs UI + burndown chart
- Velocity + forecast
- Resource histogram
- Baselines

### 24.3 Phase C (months 5-6) — Integration & Automation

- Time tracking: timer mode, approval workflow, hourly rates
- Budgets per WP, forecast vs actual
- Meeting: time slots, action items, recurring series
- Forms (standalone)
- Workflow automation builder
- Public sharing
- AI assist (assignee + duration + summarise)
- Slack/Teams/GitHub/Google Calendar integrations
- SCIM provisioning
- Audit log
- Webhook signing + retries
- PWA + offline mode

---

## 25. Top 5 Feature Improvements — Summary

The single most valuable improvements, in priority order:

1. **Workflows + configurable forms per type** — the single biggest functional gap versus the original OpenProject and the single biggest UX win. The matrix editor makes administration self-service; configurable forms let every team model their own data without engineering.

2. **Subprojects with inherited members and modules** — without hierarchy, large organisations cannot roll up work. Adding `parentId` on `Project` plus a small inheritance engine unlocks enterprise use cases.

3. **Gantt dependencies (FS/SS/FF/SF) + critical path + drag-to-edit** — the existing Gantt is read-only. Adding full dependency types and an interactive editor brings parity with MS Project and ClickUp and makes the Gantt a real planning tool, not a status display.

4. **Native workflow automation (trigger → condition → action)** — the highest-leverage "beyond the original" feature. A built-in rule engine replaces 80% of Zapier use cases, keeps data inside the instance, and creates a strong lock-in moat.

5. **AI assist (assignee / duration / summarise)** — the most visible "modern" feature. Three small models, opt-in, configurable privacy, give the product a tangible "AI-native" identity that competitors have not yet nailed.

---

## Appendix A — Glossary

| Term | Definition |
|---|---|
| **Work Package (WP)** | The atomic unit of work in OP. Can represent a task, bug, feature, milestone, risk, etc. |
| **Type** | A class of WPs (Task, Bug, Feature, Epic). Defines which custom fields apply. |
| **Status** | Where a WP is in its lifecycle (New, In progress, Closed). |
| **Workflow** | A quadruple `(type, role, fromStatus, toStatus)` indicating a permitted transition. |
| **Project** | A container for WPs, members, modules. Can have a parent. |
| **Module** | An optional feature enabled per project (Backlogs, Wiki, Forum, etc.). |
| **Role** | A bundle of permissions assigned per project. |
| **Custom Field (CF)** | A user-defined field on WPs, projects, or users. |
| **Sprint** | A time-boxed iteration (a `Version` with dates). |
| **Burndown** | A chart of remaining work over time. |
| **Webhook** | An HTTP callback fired on system events. |
| **Watchers** | Users subscribed to changes on a WP. |
| **JIT** | "Just-in-time" in the context of forms: a field that becomes required/visible based on prior input. |

## Appendix B — File / API map

| Concern | New files |
|---|---|
| Workflow admin | `pages/admin/workflows.tsx`, `pages/api/workflows/index.ts`, `pages/api/workflows/matrix.ts` |
| Form admin | `pages/admin/forms.tsx`, `pages/api/forms/index.ts`, `pages/api/forms/[id].ts` |
| Subprojects | `pages/api/projects/[id]/parent.ts`, `pages/api/projects/[id]/children.ts` |
| Relations | `pages/api/work-packages/[id]/relations.ts` |
| Burndown | `pages/api/sprints/[id]/burndown.ts` |
| Velocity | `pages/api/reports/velocity.ts` |
| Gantt deps | `pages/api/work-packages/[id]/dependencies.ts`, `lib/gantt/critical-path.ts` |
| Baselines | `pages/api/projects/[id]/baselines.ts` |
| Resource histogram | `pages/api/reports/resource-histogram.ts` |
| Time approvals | `pages/api/time-entries/approve.ts` |
| Hourly rates | `pages/api/users/[id]/rates.ts` |
| Budget forecast | `lib/budget/forecast.ts` |
| Forms (public) | `pages/forms/[token].tsx`, `pages/api/public/forms/[token].ts` |
| Automations | `pages/admin/automations.tsx`, `pages/api/automations/index.ts`, `pages/api/automations/[id]/run.ts` |
| eSignature | `pages/api/work-packages/[id]/sign.ts` |
| OKR | `pages/okr/index.tsx`, `pages/api/objectives/...` |
| Risk | `pages/projects/[id]/risks.tsx`, `pages/api/risks/...` |
| Audit | `pages/admin/audit.tsx`, `pages/api/admin/audit.ts` |
| AI | `pages/api/ai/suggest-assignee.ts`, `pages/api/ai/predict-duration.ts`, `pages/api/ai/summarise-thread.ts` |
| SCIM | `pages/api/scim/v2/Users.ts`, `pages/api/scim/v2/Groups.ts` |
| iCal | `pages/api/calendar.ics.ts`, `pages/api/projects/[id]/calendar.ics.ts` |
| Webhook signing | `lib/webhooks/sign.ts` |
| PWA | `public/manifest.json`, `public/sw.js`, `next.config.js` PWA config |
| Slack | `pages/api/integrations/slack/...` |
| Teams | `pages/api/integrations/teams/...` |
| GitHub | `pages/api/integrations/github/webhook.ts` |
| Google Calendar | `pages/api/integrations/google/calendar/...` |

## Appendix C — Open questions for the team

1. Should placeholders be project-scoped or global?
2. Should custom fields on WPs be denormalised into the WP row for performance, or kept in a side table?
3. For AI, do we use the user's API key (BYOK) or a system key (OP-hosted)?
4. For eSignature, do we need legally-binding signatures (eIDAS) or is "recorded approval" sufficient for v1?
5. For SCIM, do we support `push` (OP is the source of truth) or `pull` (IdP is the source of truth)? — We plan to support both.
6. For offline mode, do we need to support full text search offline, or just navigation + recent items?
7. For automation, do we expose a CLI for admins to write rules in code, or is the visual builder enough?
8. For public sharing, do we charge for it (paywall) or keep it free?
9. For OKR/risk register, are these v1 or post-launch?
10. For the templates marketplace, who curates the public catalog?

---

**End of document.**

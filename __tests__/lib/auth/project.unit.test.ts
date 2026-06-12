/**
 * Phase 3 Sprint 2 — Unit tests for lib/auth/project.ts (RBAC-3 critical fix).
 *
 * This file addresses the Phase 1 critical finding that the most-used RBAC
 * surface in the codebase (13 `assertXxxProjectMembership` helpers plus the
 * base `assertProjectMembership`) had zero direct unit tests. The 80
 * route-level tests referenced in AGENTS.md cover *route* behaviour that
 * uses these helpers — but any refactor of the helpers themselves (e.g.
 * the wildcard-aware consolidation proposed in RBAC-2) had no failing
 * test to catch regressions.
 *
 * Mocking strategy mirrors `__tests__/api/work-package-permissions.unit.test.ts`:
 * `vi.hoisted` creates a stable object of vi.fn() mocks that the factory
 * closes over. Required because vi.mock factory bodies are hoisted to the
 * top of the file — if they call vi.fn() inline, the test-time
 * mockResolvedValue calls are lost on each import.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Stable mock handles ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  return {
    c,
    projectFindUnique: vi.fn(),
    memberFindUnique: vi.fn(),
    forumFindUnique: vi.fn(),
    forumThreadFindUnique: vi.fn(),
    forumPostFindUnique: vi.fn(),
    meetingFindUnique: vi.fn(),
    meetingAgendaItemFindUnique: vi.fn(),
    meetingMinutesFindUnique: vi.fn(),
    meetingAttendeeFindUnique: vi.fn(),
    wikiPageFindUnique: vi.fn(),
    wikiPageFindFirst: vi.fn(),
    documentFindUnique: vi.fn(),
    documentFolderFindUnique: vi.fn(),
    workPackageFindUnique: vi.fn(),
    workPackageRelationFindUnique: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    member: { findUnique: mocks.memberFindUnique },
    forum: { findUnique: mocks.forumFindUnique },
    forumThread: { findUnique: mocks.forumThreadFindUnique },
    forumPost: { findUnique: mocks.forumPostFindUnique },
    meeting: { findUnique: mocks.meetingFindUnique },
    meetingAgendaItem: { findUnique: mocks.meetingAgendaItemFindUnique },
    meetingMinutes: { findUnique: mocks.meetingMinutesFindUnique },
    meetingAttendee: { findUnique: mocks.meetingAttendeeFindUnique },
    wikiPage: {
      findUnique: mocks.wikiPageFindUnique,
      findFirst: mocks.wikiPageFindFirst,
    },
    document: { findUnique: mocks.documentFindUnique },
    documentFolder: { findUnique: mocks.documentFolderFindUnique },
    workPackage: { findUnique: mocks.workPackageFindUnique },
    workPackageRelation: { findUnique: mocks.workPackageRelationFindUnique },
  },
}))

// ─── Import after mocks ──────────────────────────────────────────────────
import { ApiError } from '@/lib/api/withRoute'
import {
  assertProjectMembership,
  assertForumProjectMembership,
  assertThreadProjectMembership,
  assertPostProjectMembership,
  assertMeetingProjectMembership,
  assertMeetingAgendaProjectMembership,
  assertMeetingMinutesProjectMembership,
  assertMeetingAttendeeProjectMembership,
  assertWikiPageProjectMembership,
  assertWikiPageBySlugProjectMembership,
  assertDocumentProjectMembership,
  assertFolderProjectMembership,
  assertWorkPackageProjectMembership,
  assertRelationProjectMembership,
} from '@/lib/auth/project'

const { c } = mocks

beforeEach(() => {
  vi.clearAllMocks()
})

// ════════════════════════════════════════════════════════════════════════
//  assertProjectMembership (base helper)
// ════════════════════════════════════════════════════════════════════════
describe('assertProjectMembership', () => {
  it('throws 400 BAD_REQUEST on missing projectId', async () => {
    await expect(
      assertProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
    await expect(
      assertProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 PROJECT_NOT_FOUND when project does not exist', async () => {
    mocks.projectFindUnique.mockResolvedValue(null)
    await expect(
      assertProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'PROJECT_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a member', async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns void on happy path (member exists)', async () => {
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertProjectMembership(c(1), 'u1', false)
    ).resolves.toBeUndefined()
  })

  it('bypasses all checks when isSystemAdmin=true', async () => {
    await expect(
      assertProjectMembership(c(1), 'admin1', true)
    ).resolves.toBeUndefined()
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════
//  assertForumProjectMembership
// ════════════════════════════════════════════════════════════════════════
describe('assertForumProjectMembership', () => {
  it('throws 400 on missing forumId', async () => {
    await expect(
      assertForumProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 FORUM_NOT_FOUND when forum does not exist', async () => {
    mocks.forumFindUnique.mockResolvedValue(null)
    await expect(
      assertForumProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'FORUM_NOT_FOUND' })
  })

  it('throws 403 when user is not a member of the forum project', async () => {
    mocks.forumFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertForumProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path', async () => {
    mocks.forumFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertForumProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })

  it('bypasses when isSystemAdmin=true (still resolves projectId via lookup)', async () => {
    // Note: assertForumProjectMembership resolves forumId -> projectId FIRST
    // (no 400 on empty id means admin still needs to know which project
    // they're bypassing for). assertProjectMembership then short-circuits.
    // Empty forumId still throws 400 regardless of admin.
    await expect(
      assertForumProjectMembership('', 'admin1', true)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
    mocks.forumFindUnique.mockResolvedValue({ projectId: c(2) })
    await expect(
      assertForumProjectMembership(c(1), 'admin1', true)
    ).resolves.toBe(c(2))
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════
//  assertThreadProjectMembership
// ════════════════════════════════════════════════════════════════════════
describe('assertThreadProjectMembership', () => {
  it('throws 400 on missing threadId', async () => {
    await expect(
      assertThreadProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 THREAD_NOT_FOUND when thread does not exist', async () => {
    mocks.forumThreadFindUnique.mockResolvedValue(null)
    await expect(
      assertThreadProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'THREAD_NOT_FOUND' })
  })

  it('returns forumId+projectId on happy path', async () => {
    mocks.forumThreadFindUnique.mockResolvedValue({
      forumId: c(3),
      forum: { projectId: c(2) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertThreadProjectMembership(c(1), 'u1', false)
    ).resolves.toEqual({ projectId: c(2), forumId: c(3) })
  })

  it('throws 403 when not a project member', async () => {
    mocks.forumThreadFindUnique.mockResolvedValue({
      forumId: c(3),
      forum: { projectId: c(2) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertThreadProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})

// ════════════════════════════════════════════════════════════════════════
//  assertPostProjectMembership
// ════════════════════════════════════════════════════════════════════════
describe('assertPostProjectMembership', () => {
  it('throws 400 on missing postId', async () => {
    await expect(
      assertPostProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 POST_NOT_FOUND when post does not exist', async () => {
    mocks.forumPostFindUnique.mockResolvedValue(null)
    await expect(
      assertPostProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'POST_NOT_FOUND' })
  })

  it('resolves post → thread → forum → project on happy path', async () => {
    mocks.forumPostFindUnique.mockResolvedValue({
      threadId: c(4),
      thread: { forumId: c(3), forum: { projectId: c(2) } },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertPostProjectMembership(c(1), 'u1', false)
    ).resolves.toEqual({ projectId: c(2), forumId: c(3), threadId: c(4) })
  })

  it('throws 403 when not a project member', async () => {
    mocks.forumPostFindUnique.mockResolvedValue({
      threadId: c(4),
      thread: { forumId: c(3), forum: { projectId: c(2) } },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertPostProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})

// ════════════════════════════════════════════════════════════════════════
//  Meeting helpers (4 helpers, same shape)
// ════════════════════════════════════════════════════════════════════════
describe('assertMeetingProjectMembership', () => {
  it('throws 400 on missing meetingId', async () => {
    await expect(
      assertMeetingProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 MEETING_NOT_FOUND when meeting does not exist', async () => {
    mocks.meetingFindUnique.mockResolvedValue(null)
    await expect(
      assertMeetingProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'MEETING_NOT_FOUND' })
  })

  it('returns projectId on happy path', async () => {
    mocks.meetingFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertMeetingProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })

  it('throws 403 when not a project member', async () => {
    mocks.meetingFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertMeetingProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})

describe('assertMeetingAgendaProjectMembership', () => {
  it('throws 400 on missing agendaId', async () => {
    await expect(
      assertMeetingAgendaProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 AGENDA_ITEM_NOT_FOUND', async () => {
    mocks.meetingAgendaItemFindUnique.mockResolvedValue(null)
    await expect(
      assertMeetingAgendaProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'AGENDA_ITEM_NOT_FOUND' })
  })

  it('returns projectId on happy path', async () => {
    mocks.meetingAgendaItemFindUnique.mockResolvedValue({
      meetingId: c(3),
      meeting: { projectId: c(2) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertMeetingAgendaProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })
})

describe('assertMeetingMinutesProjectMembership', () => {
  it('throws 400 on missing minutesId', async () => {
    await expect(
      assertMeetingMinutesProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 MINUTES_NOT_FOUND', async () => {
    mocks.meetingMinutesFindUnique.mockResolvedValue(null)
    await expect(
      assertMeetingMinutesProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'MINUTES_NOT_FOUND' })
  })

  it('returns projectId on happy path', async () => {
    mocks.meetingMinutesFindUnique.mockResolvedValue({
      meetingId: c(3),
      meeting: { projectId: c(2) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertMeetingMinutesProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })
})

describe('assertMeetingAttendeeProjectMembership', () => {
  it('throws 400 on missing attendeeId', async () => {
    await expect(
      assertMeetingAttendeeProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 ATTENDEE_NOT_FOUND', async () => {
    mocks.meetingAttendeeFindUnique.mockResolvedValue(null)
    await expect(
      assertMeetingAttendeeProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'ATTENDEE_NOT_FOUND' })
  })

  it('returns projectId on happy path', async () => {
    mocks.meetingAttendeeFindUnique.mockResolvedValue({
      meetingId: c(3),
      meeting: { projectId: c(2) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertMeetingAttendeeProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })
})

// ════════════════════════════════════════════════════════════════════════
//  Wiki helpers (2)
// ════════════════════════════════════════════════════════════════════════
describe('assertWikiPageProjectMembership', () => {
  it('throws 400 on missing wikiPageId', async () => {
    await expect(
      assertWikiPageProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 WIKI_PAGE_NOT_FOUND', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WIKI_PAGE_NOT_FOUND' })
  })

  it('returns projectId on happy path', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertWikiPageProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })
})

describe('assertWikiPageBySlugProjectMembership', () => {
  it('throws 400 on missing slug', async () => {
    await expect(
      assertWikiPageBySlugProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 WIKI_PAGE_NOT_FOUND when no page matches slug', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue(null)
    await expect(
      assertWikiPageBySlugProjectMembership('my-page', 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WIKI_PAGE_NOT_FOUND' })
  })

  it('returns {projectId, pageId} on happy path', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue({ id: c(5), projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertWikiPageBySlugProjectMembership('my-page', 'u1', false)
    ).resolves.toEqual({ projectId: c(2), pageId: c(5) })
  })

  it('throws 403 when not a project member', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue({ id: c(5), projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageBySlugProjectMembership('my-page', 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})

// ════════════════════════════════════════════════════════════════════════
//  Document + folder helpers
// ════════════════════════════════════════════════════════════════════════
describe('assertDocumentProjectMembership', () => {
  it('throws 400 on missing documentId', async () => {
    await expect(
      assertDocumentProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 DOCUMENT_NOT_FOUND', async () => {
    mocks.documentFindUnique.mockResolvedValue(null)
    await expect(
      assertDocumentProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'DOCUMENT_NOT_FOUND' })
  })

  it('returns projectId on happy path', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertDocumentProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })
})

describe('assertFolderProjectMembership', () => {
  it('throws 400 on missing folderId', async () => {
    await expect(
      assertFolderProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 FOLDER_NOT_FOUND', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue(null)
    await expect(
      assertFolderProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'FOLDER_NOT_FOUND' })
  })

  it('returns projectId on happy path', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertFolderProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })
})

// ════════════════════════════════════════════════════════════════════════
//  Work package + relation helpers
// ════════════════════════════════════════════════════════════════════════
describe('assertWorkPackageProjectMembership', () => {
  it('throws 400 on missing workPackageId', async () => {
    await expect(
      assertWorkPackageProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 WORK_PACKAGE_NOT_FOUND', async () => {
    mocks.workPackageFindUnique.mockResolvedValue(null)
    await expect(
      assertWorkPackageProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WORK_PACKAGE_NOT_FOUND' })
  })

  it('returns projectId on happy path', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertWorkPackageProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })

  it('throws 403 when not a project member', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertWorkPackageProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})

describe('assertRelationProjectMembership', () => {
  it('throws 400 on missing relationId', async () => {
    await expect(
      assertRelationProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 RELATION_NOT_FOUND', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue(null)
    await expect(
      assertRelationProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'RELATION_NOT_FOUND' })
  })

  it('returns projectId (resolves via relation.from.projectId)', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(2) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    await expect(
      assertRelationProjectMembership(c(1), 'u1', false)
    ).resolves.toBe(c(2))
  })

  it('throws 403 when not a project member', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(2) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(2) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertRelationProjectMembership(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})
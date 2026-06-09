/**
 * Phase 7 Sprint B-3.1 (helpers commit) — Direct unit tests for the
 * `assertWikiPage*ProjectMembership` helpers in `lib/auth/project.ts`.
 *
 * Route integration tests (401/403/404 via the actual handler) are
 * shipped in the next commit (route migration) following the B-1 / B-2
 * pattern where the helper commit lands first and is independently
 * testable without handler wiring.
 *
 * Mocking strategy: `vi.hoisted` creates a stable object of vi.fn()
 * mocks that the factory closes over. This is required because
 * vi.mock factory bodies are hoisted to the top of the file — if
 * they call vi.fn() inline, the test-time mockResolvedValue calls
 * are lost (each handler import re-invokes the factory).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Stable mock handles (vi.hoisted runs before vi.mock) ──────────────────
const mocks = vi.hoisted(() => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  return {
    c,
    projectFindUnique: vi.fn(),
    memberFindUnique: vi.fn(),
    wikiPageFindUnique: vi.fn(),
    wikiPageFindFirst: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    member: { findUnique: mocks.memberFindUnique },
    wikiPage: {
      findUnique: mocks.wikiPageFindUnique,
      findFirst: mocks.wikiPageFindFirst,
    },
  },
}))

import {
  assertWikiPageProjectMembership,
  assertWikiPageBySlugProjectMembership,
} from '@/lib/auth/project'
import { ApiError } from '@/lib/api/withRoute'

const { c } = mocks

beforeEach(() => {
  vi.clearAllMocks()
})

describe('assertWikiPageProjectMembership helper', () => {
  it('throws 400 ApiError on missing wikiPageId', async () => {
    await expect(
      assertWikiPageProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('throws 404 WIKI_PAGE_NOT_FOUND when page does not exist', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WIKI_PAGE_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path (member exists)', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertWikiPageProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
    expect(mocks.wikiPageFindUnique).toHaveBeenCalledWith({
      where: { id: c(2) },
      select: { projectId: true },
    })
  })

  it('system admin bypasses both project and member lookups', async () => {
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(1) })
    const result = await assertWikiPageProjectMembership(c(2), 'admin1', true)
    expect(result).toBe(c(1))
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })

  it('throws 404 PROJECT_NOT_FOUND when page belongs to non-existent project', async () => {
    // Should not happen in practice (FK), but assertProjectMembership
    // checks project existence first — if project was deleted out from
    // under the wiki page, we want a clean 404, not 403.
    mocks.wikiPageFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'PROJECT_NOT_FOUND' })
  })
})

describe('assertWikiPageBySlugProjectMembership helper', () => {
  it('throws 400 ApiError on missing slug', async () => {
    await expect(
      assertWikiPageBySlugProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('throws 404 WIKI_PAGE_NOT_FOUND when no page matches slug', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue(null)
    await expect(
      assertWikiPageBySlugProjectMembership('missing', 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WIKI_PAGE_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue({ id: c(2), projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertWikiPageBySlugProjectMembership('test-page', 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns {projectId, pageId} on happy path', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue({ id: c(2), projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertWikiPageBySlugProjectMembership('test-page', 'u1', false)
    expect(result).toEqual({ projectId: c(1), pageId: c(2) })
  })

  it('system admin bypasses project and member lookups', async () => {
    mocks.wikiPageFindFirst.mockResolvedValue({ id: c(2), projectId: c(1) })
    const result = await assertWikiPageBySlugProjectMembership('admin-slug', 'admin1', true)
    expect(result).toEqual({ projectId: c(1), pageId: c(2) })
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
  })
})

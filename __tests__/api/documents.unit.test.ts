/**
 * Phase 7 Sprint B-3.2 (helpers commit) — Direct unit tests for the
 * `assertDocumentProjectMembership` and `assertFolderProjectMembership`
 * helpers in `lib/auth/project.ts`.
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
    documentFindUnique: vi.fn(),
    documentFolderFindUnique: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findUnique: mocks.projectFindUnique },
    member: { findUnique: mocks.memberFindUnique },
    document: { findUnique: mocks.documentFindUnique },
    documentFolder: { findUnique: mocks.documentFolderFindUnique },
  },
}))

import {
  assertDocumentProjectMembership,
  assertFolderProjectMembership,
} from '@/lib/auth/project'
import { ApiError } from '@/lib/api/withRoute'

const { c } = mocks

beforeEach(() => {
  vi.clearAllMocks()
})

// ════════════════════════════════════════════════════════════════════════
//  assertDocumentProjectMembership
// ════════════════════════════════════════════════════════════════════════
describe('assertDocumentProjectMembership helper', () => {
  it('throws 400 ApiError on missing documentId', async () => {
    await expect(
      assertDocumentProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('throws 404 DOCUMENT_NOT_FOUND when document does not exist', async () => {
    mocks.documentFindUnique.mockResolvedValue(null)
    await expect(
      assertDocumentProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'DOCUMENT_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertDocumentProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path (member exists)', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertDocumentProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
    expect(mocks.documentFindUnique).toHaveBeenCalledWith({
      where: { id: c(2) },
      select: { projectId: true },
    })
  })

  it('system admin bypasses both project and member lookups', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(1) })
    const result = await assertDocumentProjectMembership(c(2), 'admin1', true)
    expect(result).toBe(c(1))
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })

  it('throws 404 PROJECT_NOT_FOUND when document belongs to non-existent project', async () => {
    mocks.documentFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue(null)
    await expect(
      assertDocumentProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'PROJECT_NOT_FOUND' })
  })
})

// ════════════════════════════════════════════════════════════════════════
//  assertFolderProjectMembership
// ════════════════════════════════════════════════════════════════════════
describe('assertFolderProjectMembership helper', () => {
  it('throws 400 ApiError on missing folderId', async () => {
    await expect(
      assertFolderProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('throws 404 FOLDER_NOT_FOUND when folder does not exist', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue(null)
    await expect(
      assertFolderProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'FOLDER_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertFolderProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path (member exists)', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue({ projectId: c(1) })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertFolderProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
    expect(mocks.documentFolderFindUnique).toHaveBeenCalledWith({
      where: { id: c(2) },
      select: { projectId: true },
    })
  })

  it('system admin bypasses both project and member lookups', async () => {
    mocks.documentFolderFindUnique.mockResolvedValue({ projectId: c(1) })
    const result = await assertFolderProjectMembership(c(2), 'admin1', true)
    expect(result).toBe(c(1))
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})

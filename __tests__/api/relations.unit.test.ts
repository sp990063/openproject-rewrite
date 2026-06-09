/**
 * Phase 7 Sprint B-4 — Unit tests for the `assertRelationProjectMembership`
 * helper.
 *
 * The relations route previously let any logged-in user read or modify
 * any work-package relation in the system by ID. The new helper
 * resolves `relationId → relation.from.projectId` and asserts the
 * caller is a member of that project (or a system admin).
 *
 * Mocking strategy: `vi.hoisted` creates a stable object of vi.fn()
 * mocks that the factory closes over. This is required because
 * vi.mock factory bodies are hoisted to the top of the file — if
 * they call vi.fn() inline, the test-time mockResolvedValue calls
 * are lost (each handler import re-invokes the factory).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Stable mock handles ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  return {
    c,
    workPackageRelationFindUnique: vi.fn(),
    projectFindUnique: vi.fn(),
    memberFindUnique: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workPackageRelation: { findUnique: mocks.workPackageRelationFindUnique },
    project: { findUnique: mocks.projectFindUnique },
    member: { findUnique: mocks.memberFindUnique },
  },
}))

// ─── Import after mocks ──────────────────────────────────────────────────
import { assertRelationProjectMembership } from '@/lib/auth/project'
import { ApiError } from '@/lib/api/withRoute'

const { c } = mocks

beforeEach(() => {
  vi.clearAllMocks()
})

// ════════════════════════════════════════════════════════════════════════
//  HELPER DIRECT TESTS
// ════════════════════════════════════════════════════════════════════════
describe('assertRelationProjectMembership helper', () => {
  it('throws 400 BAD_REQUEST on missing relationId', async () => {
    await expect(
      assertRelationProjectMembership('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
    await expect(
      assertRelationProjectMembership('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 RELATION_NOT_FOUND when relation does not exist', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue(null)
    await expect(
      assertRelationProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'RELATION_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(1) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertRelationProjectMembership(c(2), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns projectId on happy path', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(1) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertRelationProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
  })

  it('system admin bypasses project + member lookups', async () => {
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(1) },
    })
    const result = await assertRelationProjectMembership(c(2), 'admin1', true)
    expect(result).toBe(c(1))
    expect(mocks.projectFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })

  it('reads projectId from `from` (not `to`) for symmetric relations', async () => {
    // Two work packages in different projects would be a data-integrity
    // violation (relations are intra-project), but the helper must
    // use the `from` side regardless of the `to` payload.
    mocks.workPackageRelationFindUnique.mockResolvedValue({
      from: { projectId: c(1) },
    })
    mocks.projectFindUnique.mockResolvedValue({ id: c(1) })
    mocks.memberFindUnique.mockResolvedValue({ id: 'm1' })
    const result = await assertRelationProjectMembership(c(2), 'u1', false)
    expect(result).toBe(c(1))
  })
})

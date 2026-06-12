/**
 * Phase 7 Sprint A — Unit tests for the work-package *Permission helpers
 * (assertWorkPackageEditPermission, assertWorkPackageDeletePermission).
 *
 * Both helpers follow the same shape: resolve workPackage → projectId,
 * verify project membership + role permission. Edit checks
 * `WORK_PACKAGE_EDIT`, delete checks `WORK_PACKAGE_DELETE`. System admins
 * bypass both.
 *
 * Mocking strategy: `vi.hoisted` creates a stable object of vi.fn() mocks
 * that the factory closes over. This is required because vi.mock
 * factory bodies are hoisted to the top of the file — if they call
 * vi.fn() inline, the test-time mockResolvedValue calls are lost (each
 * handler import re-invokes the factory).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Stable mock handles ──────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const c = (n: number) => `c${'0'.repeat(24)}${n}`
  return {
    c,
    workPackageFindUnique: vi.fn(),
    memberFindUnique: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workPackage: { findUnique: mocks.workPackageFindUnique },
    member: { findUnique: mocks.memberFindUnique },
  },
}))

// ─── Import after mocks ──────────────────────────────────────────────────
import { ApiError } from '@/lib/api/withRoute'
import {
  assertWorkPackageEditPermission,
  assertWorkPackageDeletePermission,
} from '@/lib/auth/workPackage'

const { c } = mocks

beforeEach(() => {
  vi.clearAllMocks()
})

// ════════════════════════════════════════════════════════════════════════
//  assertWorkPackageEditPermission
// ════════════════════════════════════════════════════════════════════════
describe('assertWorkPackageEditPermission', () => {
  it('throws 404 WORK_PACKAGE_NOT_FOUND on missing workPackageId', async () => {
    await expect(
      assertWorkPackageEditPermission('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
    await expect(
      assertWorkPackageEditPermission('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 WORK_PACKAGE_NOT_FOUND when WP does not exist', async () => {
    mocks.workPackageFindUnique.mockResolvedValue(null)
    await expect(
      assertWorkPackageEditPermission(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WORK_PACKAGE_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertWorkPackageEditPermission(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('throws 403 FORBIDDEN when member lacks WORK_PACKAGE_EDIT permission', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.memberFindUnique.mockResolvedValue({
      role: { permissions: ['WORK_PACKAGE_VIEW'] },
    })
    await expect(
      assertWorkPackageEditPermission(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns void on happy path (member with WORK_PACKAGE_EDIT)', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.memberFindUnique.mockResolvedValue({
      role: { permissions: ['WORK_PACKAGE_VIEW', 'WORK_PACKAGE_EDIT'] },
    })
    await expect(
      assertWorkPackageEditPermission(c(1), 'u1', false)
    ).resolves.toBeUndefined()
  })

  it('bypasses all checks when isSystemAdmin=true', async () => {
    await expect(
      assertWorkPackageEditPermission(c(1), 'admin1', true)
    ).resolves.toBeUndefined()
    expect(mocks.workPackageFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════
//  assertWorkPackageDeletePermission
// ════════════════════════════════════════════════════════════════════════
describe('assertWorkPackageDeletePermission', () => {
  it('throws 400 BAD_REQUEST on missing workPackageId', async () => {
    await expect(
      assertWorkPackageDeletePermission('', 'u1', false)
    ).rejects.toBeInstanceOf(ApiError)
    await expect(
      assertWorkPackageDeletePermission('', 'u1', false)
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' })
  })

  it('throws 404 WORK_PACKAGE_NOT_FOUND when WP does not exist', async () => {
    mocks.workPackageFindUnique.mockResolvedValue(null)
    await expect(
      assertWorkPackageDeletePermission(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 404, code: 'WORK_PACKAGE_NOT_FOUND' })
  })

  it('throws 403 FORBIDDEN when user is not a project member', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.memberFindUnique.mockResolvedValue(null)
    await expect(
      assertWorkPackageDeletePermission(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('throws 403 FORBIDDEN when member only has WORK_PACKAGE_EDIT (no DELETE)', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.memberFindUnique.mockResolvedValue({
      role: { permissions: ['WORK_PACKAGE_VIEW', 'WORK_PACKAGE_EDIT'] },
    })
    await expect(
      assertWorkPackageDeletePermission(c(1), 'u1', false)
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('returns void on happy path (member with WORK_PACKAGE_DELETE)', async () => {
    mocks.workPackageFindUnique.mockResolvedValue({ projectId: c(2) })
    mocks.memberFindUnique.mockResolvedValue({
      role: { permissions: ['WORK_PACKAGE_EDIT', 'WORK_PACKAGE_DELETE'] },
    })
    await expect(
      assertWorkPackageDeletePermission(c(1), 'u1', false)
    ).resolves.toBeUndefined()
  })

  it('bypasses all checks when isSystemAdmin=true', async () => {
    await expect(
      assertWorkPackageDeletePermission(c(1), 'admin1', true)
    ).resolves.toBeUndefined()
    expect(mocks.workPackageFindUnique).not.toHaveBeenCalled()
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
  })
})

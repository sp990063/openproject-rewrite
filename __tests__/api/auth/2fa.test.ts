import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
  authOptions: {},
}))

import { getServerSession } from '@/lib/auth'
import setupHandler from '@/pages/api/auth/2fa/setup'
import verifyHandler from '@/pages/api/auth/2fa/verify'

describe('2FA Setup API - auth guard', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 without session', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as any)
    const { req, res } = createMocks({ method: 'POST', body: { action: 'generate' } })
    await setupHandler(req as NextApiRequest, res as NextApiResponse)
    expect(res._getStatusCode()).toBe(401)
  })
})

describe('2FA Verify API - auth guard', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 without session', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null as any)
    const { req, res } = createMocks({ method: 'POST', body: { method: 'totp', token: '123456' } })
    await verifyHandler(req as NextApiRequest, res as NextApiResponse)
    expect(res._getStatusCode()).toBe(401)
  })
})

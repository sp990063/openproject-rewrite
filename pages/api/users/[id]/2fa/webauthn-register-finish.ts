// pages/api/users/[id]/2fa/webauthn-register-finish.ts
// SEC-5 (Phase 0): Complete WebAuthn registration. The setup endpoint issued
// options and persisted the challenge to Redis. This endpoint receives the
// client attestation response, looks up & deletes the one-shot challenge
// (5-minute TTL), verifies the signature against the expected challenge /
// origin / RP-ID, and persists a new WebAuthnCredential row.
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyRegistration } from '@/lib/2fa/webauthn'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userId = req.query.id as string
  if (session.user.id !== userId && !session.user.isSystemAdmin) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  // Pass-through to verifier; it will GETDEL the persisted challenge.
  const result = await verifyRegistration(userId, req.body)
  if (!result.verified || !result.credentialId || !result.credentialPublicKey) {
    return res.status(400).json({ error: 'WebAuthn registration failed' })
  }

  // Persist credential. If the same credentialId was already enrolled
  // (re-registration flow), Prisma's @unique constraint on credentialId
  // will throw — surface that as 409 to the client.
  try {
    await prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: result.credentialId,
        credentialPublicKey: result.credentialPublicKey,
        counter: result.counter ?? 0,
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'This authenticator is already enrolled' })
    }
    return res.status(500).json({ error: 'Failed to persist credential' })
  }

  return res.status(200).json({ success: true, enabled: true })
}

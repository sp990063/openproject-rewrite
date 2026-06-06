// lib/2fa/webauthn.ts — WebAuthn 2FA using @simplewebauthn/server
// SEC-5 (Phase 0): Persist the registration / authentication challenge in
// Redis with a 5-minute TTL instead of generating-and-discarding it. The
// previous implementation generated a challenge per call but never stored
// it, so the verify step had no way to recover the expected challenge —
// registration & login were both non-functional, and any future code path
// that logged or replayed the challenge would leak a one-shot secret.
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers'
import { Redis } from '@upstash/redis'
import { recordSecurityEvent } from '@/lib/security/audit'

export interface WebauthnUser {
  id: string
  name: string
  displayName: string
}

const CHALLENGE_TTL_SECONDS = 5 * 60 // 5 minutes per design §4.3.2

let redis: Redis | null = null
function getRedis(): Redis | null {
  // Allow tests / local dev to run without Redis. If unconfigured, we still
  // surface useful errors at the verify call site.
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

function challengeKey(userId: string, kind: 'register' | 'authenticate'): string {
  return `webauthn:challenge:${kind}:${userId}`
}

function randomChallenge(): Uint8Array<ArrayBuffer> {
  // 32 bytes = 256 bits of entropy (WebAuthn spec minimum).
  // Cast to satisfy @simplewebauthn v13's stricter `Uint8Array<ArrayBuffer>` typing.
  const out = new Uint8Array(new ArrayBuffer(32))
  crypto.getRandomValues(out)
  return out
}

function toBase64Url(buf: Uint8Array): string {
  // @simplewebauthn v13 accepts `Uint8Array<ArrayBufferLike>` at runtime; cast to satisfy the type.
  return isoBase64URL.fromBuffer(buf as unknown as Uint8Array<ArrayBuffer>)
}

/**
 * Persist a freshly generated challenge to Redis with a 5-minute TTL.
 * Returns the base64url-encoded challenge that the client must sign.
 * The caller is expected to pass this challenge back into `verifyRegistration`
 * or `verifyAuthentication` — the verifier will read & delete it.
 */
async function persistChallenge(
  userId: string,
  kind: 'register' | 'authenticate',
  challenge: Uint8Array
): Promise<string> {
  const encoded = toBase64Url(challenge)
  const r = getRedis()
  if (r) {
    await r.set(challengeKey(userId, kind), encoded, { ex: CHALLENGE_TTL_SECONDS })
  }
  // Even if Redis is unavailable, we still return the encoded challenge —
  // the caller can decide whether to abort. We do NOT silently store in
  // memory: that would re-introduce the cross-request leak we're fixing.
  return encoded
}

async function consumeChallenge(
  userId: string,
  kind: 'register' | 'authenticate'
): Promise<string | null> {
  const r = getRedis()
  if (!r) {
    await recordSecurityEvent({
      type: 'WEBAUTHN_CHALLENGE_MISS',
      ip: null,
      userId,
      meta: { kind, reason: 'redis_unconfigured' },
    })
    return null
  }
  // GETDEL: read-and-delete in a single round-trip (Redis 6.2+).
  // @ts-ignore — GETDEL is supported on @upstash/redis >= 1.25
  const value: string | null = (await r.getdel(challengeKey(userId, kind))) as string | null
  if (!value) {
    await recordSecurityEvent({
      type: 'WEBAUTHN_CHALLENGE_MISS',
      ip: null,
      userId,
      meta: { kind },
    })
  }
  return value
}

/**
 * Issue registration options and persist the challenge in Redis.
 * Returns the options the client should hand to `navigator.credentials.create()`.
 */
export async function issueRegistrationOptions(user: WebauthnUser): Promise<any> {
  const challenge = randomChallenge()
  await persistChallenge(user.id, 'register', challenge)

  await recordSecurityEvent({
    type: 'WEBAUTHN_CHALLENGE_ISSUED',
    ip: null,
    userId: user.id,
    meta: { kind: 'register' },
  })

  return generateRegistrationOptions({
    rpName: 'OpenProject',
    rpID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    userID: new TextEncoder().encode(user.id),
    userName: user.name,
    userDisplayName: user.displayName,
    attestationType: 'none',
    excludeCredentials: [],
    timeout: 60000,
    challenge,
  })
}

/**
 * Issue authentication options and persist the challenge in Redis.
 */
export async function issueAuthenticationOptions(
  userId: string,
  allowCredentials: { id: string; type: string }[]
): Promise<any> {
  const challenge = randomChallenge()
  await persistChallenge(userId, 'authenticate', challenge)

  await recordSecurityEvent({
    type: 'WEBAUTHN_CHALLENGE_ISSUED',
    ip: null,
    userId,
    meta: { kind: 'authenticate' },
  })

  return generateAuthenticationOptions({
    rpID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    // @simplewebauthn v13 expects Base64URLString (string) here, not a buffer.
    allowCredentials: allowCredentials.map((c) => ({ ...c })),
    userVerification: 'preferred',
    timeout: 60000,
    challenge,
  })
}

/**
 * Verify a registration response against the challenge we previously persisted
 * for `userId`. The challenge is one-shot: it is deleted from Redis on
 * successful retrieval.
 */
export async function verifyRegistration(
  userId: string,
  response: any
): Promise<{ verified: boolean; credentialId?: string; credentialPublicKey?: string; counter?: number }> {
  const expectedChallenge = await consumeChallenge(userId, 'register')
  if (!expectedChallenge) {
    return { verified: false }
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      expectedRPID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    })
    if (!verification.verified || !verification.registrationInfo) {
      await recordSecurityEvent({
        type: 'WEBAUTHN_REGISTRATION_FAILED',
        ip: null,
        userId,
        meta: { reason: 'not_verified' },
      })
      return { verified: false }
    }
    const { credential } = verification.registrationInfo
    return {
      verified: true,
      // v13 returns credential.id as a base64url string already; credential.publicKey is a buffer.
      credentialId: typeof credential.id === 'string' ? credential.id : isoBase64URL.fromBuffer(credential.id as unknown as Uint8Array<ArrayBuffer>),
      credentialPublicKey: isoBase64URL.fromBuffer(credential.publicKey as unknown as Uint8Array<ArrayBuffer>),
      counter: credential.counter ?? 0,
    }
  } catch (e: any) {
    await recordSecurityEvent({
      type: 'WEBAUTHN_REGISTRATION_FAILED',
      ip: null,
      userId,
      meta: { reason: 'exception', message: e?.message?.slice(0, 200) },
    })
    return { verified: false }
  }
}

/**
 * Verify an authentication response against the challenge we previously
 * persisted for `userId`. Returns the new sign counter on success so the
 * caller can persist it (and detect cloned authenticators).
 */
export async function verifyAuthentication(
  userId: string,
  response: any,
  credential: { credentialPublicKey: string; counter: number }
): Promise<{ verified: boolean; newCounter?: number }> {
  const expectedChallenge = await consumeChallenge(userId, 'authenticate')
  if (!expectedChallenge) {
    return { verified: false }
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      expectedRPID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
      credential: {
        id: response.id,
        publicKey: isoBase64URL.toBuffer(credential.credentialPublicKey),
        counter: credential.counter,
      },
    })
    await recordSecurityEvent({
      type: verification.verified ? 'WEBAUTHN_AUTH_SUCCESS' : 'WEBAUTHN_AUTH_FAILED',
      ip: null,
      userId,
    })
    return {
      verified: verification.verified,
      newCounter: verification.authenticationInfo?.newCounter,
    }
  } catch (e: any) {
    await recordSecurityEvent({
      type: 'WEBAUTHN_AUTH_FAILED',
      ip: null,
      userId,
      meta: { reason: 'exception', message: e?.message?.slice(0, 200) },
    })
    return { verified: false }
  }
}

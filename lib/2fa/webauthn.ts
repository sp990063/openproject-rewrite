// lib/2fa/webauthn.ts — WebAuthn 2FA using @simplewebauthn/server
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { isoUint8ArrayToBase64, isoBase64ToUint8Array } from '@simplewebauthn/server/helpers'

export interface WebauthnUser {
  id: string
  name: string
  displayName: string
}

function randomChallenge(): string {
  const buf = crypto.randomBytes(32)
  return isoUint8ArrayToBase64(buf)
}

export async function generateRegistrationOptions(user: WebauthnUser): Promise<any> {
  return generateRegistrationOptions({
    rpName: 'OpenProject',
    rpID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    userID: user.id,
    userName: user.name,
    userDisplayName: user.displayName,
    attestationType: 'none',
    excludeCredentials: [],
    timeout: 60000,
    challenge: randomChallenge(),
  })
}

export async function generateAuthenticationOptions(
  allowCredentials: { id: string; type: string }[]
): Promise<any> {
  return generateAuthenticationOptions({
    rpID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    allowCredentials: allowCredentials.map(c => ({ ...c, id: isoBase64ToUint8Array(c.id) })),
    userVerification: 'preferred',
    timeout: 60000,
    challenge: randomChallenge(),
  })
}

export async function verifyRegistration(response: any, expectedChallenge: string): Promise<boolean> {
  try {
    const { verified } = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      expectedRPID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    })
    return verified
  } catch {
    return false
  }
}

export async function verifyAuthentication(
  response: any,
  expectedChallenge: string,
  authenticator: { credentialPublicKey: string; counter: number }
): Promise<{ verified: boolean; newCounter: number }> {
  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      expectedRPID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
      authenticator: {
        credentialPublicKey: isoBase64ToUint8Array(authenticator.credentialPublicKey),
        counter: authenticator.counter,
      },
    })
    return {
      verified: verification.verified,
      newCounter: verification.authenticationInfo.newCounter,
    }
  } catch {
    return { verified: false, newCounter: 0 }
  }
}

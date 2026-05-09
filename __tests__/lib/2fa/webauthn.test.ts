import { describe, it, expect, vi } from 'vitest'

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(() => ({
    challenge: 'mock-challenge',
    rp: { name: 'OpenProject', id: 'localhost' },
    user: { id: new Uint8Array([1,2,3,4]), name: 'test', displayName: 'Test User' },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    timeout: 60000,
    excludeCredentials: [],
    attestation: 'none',
  })),
  generateAuthenticationOptions: vi.fn(() => ({
    challenge: 'mock-challenge',
    rpId: 'localhost',
    allowCredentials: [],
    userVerification: 'preferred',
  })),
  verifyRegistrationResponse: vi.fn(() => ({ verified: true })),
  verifyAuthenticationResponse: vi.fn(() => ({ verified: true, authenticationInfo: { newCounter: 1 } })),
}))

describe('WebAuthn', () => {
  it('generates registration options via mock', async () => {
    const { generateRegistrationOptions } = await import('@simplewebauthn/server')
    const opts = await generateRegistrationOptions({
      rpName: 'Test', rpID: 'localhost',
      userID: new Uint8Array([1,2,3,4]), userName: 'test', userDisplayName: 'Test',
    })
    expect(opts).toBeDefined()
    expect(opts.rp.name).toBe('OpenProject')
  })
})

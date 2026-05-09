// types/user.ts — Extended user types including 2FA
export interface TwoFactorMethod {
  type: 'totp' | 'webauthn' | 'backup'
}

export interface BackupCodeEntry {
  hashedCode: string
  used: boolean
  usedAt?: Date
}

export interface WebAuthnCredentialInfo {
  credentialId: string
  deviceType?: string
  createdAt: Date
}

export interface TwoFactorSetupState {
  secret?: string
  qrCodeUrl?: string
  backupCodes?: string[]
  expiresAt: Date
}

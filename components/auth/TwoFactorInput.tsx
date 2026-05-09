// components/auth/TwoFactorInput.tsx — 2FA token input during login
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Props {
  email: string
  onSuccess: () => void
  onBack: () => void
}

export function TwoFactorInput({ email, onSuccess, onBack }: Props) {
  const [token, setToken] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [mode, setMode] = useState<'totp' | 'backup'>('totp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const body = mode === 'totp'
        ? { email, password: '', token }
        : { email, password: '', backupCode }
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429 && data.retryAfter) {
          setRetryAfter(data.retryAfter)
        }
        throw new Error(data.error || 'Verification failed')
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => { setMode('totp'); setToken(''); setError(null) }}
          className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'totp' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}
        >
          Authenticator App
        </button>
        <button
          type="button"
          onClick={() => { setMode('backup'); setToken(''); setError(null) }}
          className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${mode === 'backup' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}
        >
          Backup Code
        </button>
      </div>

      {mode === 'totp' ? (
        <Input
          value={token}
          onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          className="text-center text-2xl tracking-[0.3em] font-mono"
          autoFocus
          disabled={loading}
        />
      ) : (
        <Input
          value={backupCode}
          onChange={e => setBackupCode(e.target.value.toUpperCase().slice(0, 10))}
          placeholder="ABCD1234"
          className="text-center font-mono"
          autoFocus
          disabled={loading}
        />
      )}

      {retryAfter && (
        <p className="text-sm text-orange-600 text-center">
          Too many attempts. Try again in {retryAfter} seconds.
        </p>
      )}

      {error && !retryAfter && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      <Button type="submit" disabled={loading || (mode === 'totp' ? token.length !== 6 : backupCode.length < 4)} className="w-full">
        {loading ? 'Verifying...' : 'Verify'}
      </Button>

      <button type="button" onClick={onBack} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to login
      </button>
    </form>
  )
}

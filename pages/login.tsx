import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Button, Input } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 flex-col items-center justify-center p-12">
        <div className="max-w-md text-center">
          {/* Logo */}
          <svg width="64" height="64" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-6">
            <rect width="40" height="40" rx="8" fill="white" fillOpacity="0.2"/>
            <path d="M10 28L20 12L30 28H10Z" fill="white" fillOpacity="0.9"/>
            <circle cx="20" cy="22" r="3" fill="#3b82f6"/>
          </svg>
          <h1 className="text-3xl font-bold text-white mb-4">OpenProject</h1>
          <p className="text-blue-100 text-lg mb-8">
            Modern, fast, and intuitive project management for teams of all sizes.
          </p>
          <div className="grid grid-cols-2 gap-4 text-left">
            {[
              { label: 'Tasks & Bugs', desc: 'Track work' },
              { label: 'Gantt Charts', desc: 'Plan timelines' },
              { label: 'Team Boards', desc: 'Visual workflow' },
              { label: 'Calendars', desc: 'Schedule events' },
            ].map((f) => (
              <div key={f.label} className="bg-white/10 rounded-lg p-3">
                <p className="text-white font-medium text-sm">{f.label}</p>
                <p className="text-blue-200 text-xs">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-extrabold text-gray-900">OpenProject</h1>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">Sign in to your account</h2>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Remember me
            </label>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
            Sign in
          </Button>

          <div className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-600 hover:text-blue-500">
              Contact your administrator
            </Link>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* Logo SVG */}
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <rect width="40" height="40" rx="8" fill="#3b82f6"/>
            <path d="M10 28L20 12L30 28H10Z" fill="white" fill-opacity="0.9"/>
            <circle cx="20" cy="22" r="3" fill="#3b82f6"/>
          </svg>
          <span className="text-xl font-bold text-gray-900">OpenProject</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 py-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                  {session.user.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">{session.user.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <span className="text-gray-500 text-sm">{session.user.email}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOut({ callbackUrl: '/login' })}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/login">
            <Button variant="primary" size="sm">
              Sign in
            </Button>
          </Link>
        )}
      </div>
    </header>
  )
}

import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function middleware(req: NextRequest) {
  // Use getToken from next-auth/jwt (not the full auth() wrapper)
  // This avoids triggering @auth/core's internal page rendering in middleware
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isLoggedIn = !!token
  const pathname = req.nextUrl.pathname
  const isOnProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/projects')
  const isOnAuthRoute = pathname.startsWith('/login')

  if (isOnAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (isOnProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Exclude /api/auth/* from middleware so NextAuth handlers run without middleware interference
  matcher: ['/dashboard/:path*', '/projects/:path*', '/login', '/((?!api/auth).*)'],
}

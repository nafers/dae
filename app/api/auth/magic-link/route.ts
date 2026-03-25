import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { trackAnalyticsEvent } from '@/lib/analytics'

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const { email, nextPath } = await request.json()
  const safeNext = typeof nextPath === 'string' && nextPath.startsWith('/') ? nextPath : '/now'
  const redirectUrl = new URL('/auth/callback', requestUrl.origin)

  if (safeNext !== '/now') {
    redirectUrl.searchParams.set('next', safeNext)
  }

  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll().map(({ name, value }) => ({ name, value }))
  const cookiesToSet: Array<{
    name: string
    value: string
    options?: Parameters<typeof cookieStore.set>[2]
  }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return allCookies
        },
        setAll(nextCookies) {
          nextCookies.forEach(({ name, value, options }) => {
            const existingCookie = allCookies.find((cookie) => cookie.name === name)
            if (existingCookie) {
              existingCookie.value = value
            } else {
              allCookies.push({ name, value })
            }

            cookiesToSet.push({ name, value, options })
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl.toString(),
    },
  })

  const response = NextResponse.json(
    error ? { error: error.message } : { ok: true },
    { status: error ? 400 : 200 }
  )

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  if (!error) {
    await trackAnalyticsEvent({
      eventName: 'magic_link_requested',
      metadata: {
        nextPath: safeNext,
      },
    })
  }

  return response
}
